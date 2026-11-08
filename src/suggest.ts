/**
 * UserPromptSubmit hook: suggests at most one skill for the turn, with TypeSafe Jev.
 * Two requests, following TypeSafe's skill-suggestion cookbook (docs.typesafe.ai/cookbooks/skill_suggestion):
 * 1. rank every skill and ask whether the request needs one at all;
 * 2. re-read the top candidates with their SKILL.md openings, free to reject all of them.
 * Output is one ignorable line added to the turn (nothing when no skill fits), so Claude Code's cached prefix is untouched.
 */
import { ask, jevKey, type Question } from './jev';
import { loadRoster, type Skill } from './roster';

const SHORTLIST = 3;
const EXCERPT = 700;
const GATE = 0.3;
/** Cookbook: a request that names a specific tool, format, template or method wants a skill even when the gate is low. */
const NAMED = 0.5;
/** Cookbook uses 0.30; on this roster right picks scored 0.86+ and needless ones 0.50-0.52 (test/eval.ts). */
const FITS = 0.6;
/** Jev rejects a choice question with more than 255 options (HTTP 422), so a big roster is asked in chunks. */
const CHUNK = 250;
const TIMEOUT_MS = 4_000;

// Gate questions verbatim from the cookbook: they separate acting from explaining.
const GATE_QUESTIONS: Record<string, string> = {
  acts_on_user_system:
    "Is the assistant being asked to act on the user's files, accounts, devices, or online services, rather than only to explain or advise?",
  would_follow_documented_procedure:
    'Would a careful expert answering this consult a specific documented procedure or set of commands, rather than answering from general understanding?',
  prose_suffices:
    "Could a knowledgeable generalist fully satisfy this request in prose, with no tools, no documentation, and no access to the user's files or accounts?",
};
const INVERTED = new Set(['prose_suffices']);
const NAMED_QUESTION =
  'Does the request ask for a specific named tool, format, template, or method (for example a file type, a framework, a named workflow)?';

/** Option keys must be plain; skill ids contain ':' and '-'. */
const key = (i: number) => `s${i}`;

/** URLs are noise for Jev, and a curl command with a URL in the state draws an HTML 403 from its CDN. */
export function clean(text: string, max = 2000): string {
  return text.replace(/https?:\/\/\S+/g, '<url>').slice(0, max);
}

/** The last two real turns of the session, so a short follow-up ("do it", "install them") has something to resolve against. */
export async function recentContext(transcriptPath: string | undefined, prompt: string): Promise<string> {
  if (!transcriptPath) return '';
  try {
    const f = Bun.file(transcriptPath);
    const tail = await f.slice(Math.max(0, f.size - 200_000)).text();
    const turns: string[] = [];
    for (const line of tail.split('\n')) {
      let e: any;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e.type !== 'user' && e.type !== 'assistant') continue;
      const c = e.message?.content;
      const text = (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ') : '')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .trim();
      if (text) turns.push(`${e.type}: ${clean(text, 400)}`);
    }
    // The current prompt may already be in the transcript; it is the request, not context.
    if (turns.length && turns[turns.length - 1]!.includes(clean(prompt, 400).slice(0, 40))) turns.pop();
    return turns.slice(-2).join('\n');
  } catch {
    return '';
  }
}

export async function suggest(request: string, roster: Skill[], signal: AbortSignal, trace?: Record<string, unknown>, recent = ''): Promise<string | null> {
  if (!roster.length) return null;
  const state = { request: clean(request), recent_context: recent };

  // 1. Wide: rank everything, and gate on whether a skill is wanted at all.
  const chunks = Math.ceil(roster.length / CHUNK);
  const wide: Record<string, Question> = {};
  for (let c = 0; c < chunks; c++) {
    wide[`which_${c}`] = {
      type: 'choice',
      instructions: "Which of these skills, if any, is the right one to load to help with the user's latest request?",
      criteria: Object.fromEntries(
        roster.slice(c * CHUNK, (c + 1) * CHUNK).map((s, i) => [key(c * CHUNK + i), `${s.id}: ${s.description.slice(0, 300)}`])
      ),
    };
  }
  wide.named = { type: 'noul', instructions: NAMED_QUESTION };
  for (const [k, text] of Object.entries(GATE_QUESTIONS)) wide[`gate_${k}`] = { type: 'noul', instructions: text };
  const a1 = await ask(state, wide, signal);
  const gates = Object.keys(GATE_QUESTIONS).map((k) => {
    const a = a1[`gate_${k}`];
    const v = a?.type === 'noul' ? a.noul : 0;
    return INVERTED.has(k) ? 1 - v : v;
  });
  const gate = gates.reduce((x, y) => x + y, 0) / gates.length;
  const named = a1.named?.type === 'noul' ? a1.named.noul : 0;
  if (trace) Object.assign(trace, { gate: +gate.toFixed(2), named: +named.toFixed(2) });
  if (gate < GATE && named < NAMED) return null;

  // Each chunk answers on its own scale: keep its top candidates, then let the narrow pass judge them together.
  const ranked: [string, number][] = [];
  for (let c = 0; c < chunks; c++) {
    const w = a1[`which_${c}`];
    if (w?.type !== 'choice') continue;
    ranked.push(...Object.entries(w.probabilities ?? { [w.choice]: 1 }).sort((x, y) => y[1] - x[1]).slice(0, SHORTLIST));
  }
  const shortlist = ranked
    .sort((x, y) => y[1] - x[1])
    .slice(0, chunks > 1 ? SHORTLIST + 1 : SHORTLIST)
    .map(([k]) => roster[Number(k.slice(1))])
    .filter((s): s is Skill => Boolean(s));
  if (!shortlist.length) return null;

  // 2. Narrow: the same question over better evidence, plus an absolute "does it fit" per candidate.
  const narrow: Record<string, Question> = {
    which: {
      type: 'choice',
      instructions:
        "Exactly one of these skills is the right one to load for the user's latest request. Which one? Read what each actually does, not just its name.",
      criteria: Object.fromEntries(shortlist.map((s, i) => [key(i), `${s.id}: ${s.description} — ${s.body.slice(0, EXCERPT)}`])),
    },
  };
  shortlist.forEach((s, i) => {
    narrow[`fits_${i}`] = {
      type: 'noul',
      instructions: `Does the skill '${s.id}' do the specific thing the user's request asks for? It is described as: ${s.description}`,
    };
  });
  const a2 = await ask(state, narrow, signal);
  const fits = shortlist.map((_, i) => {
    const a = a2[`fits_${i}`];
    return a?.type === 'noul' ? a.noul : 0;
  });
  if (trace) trace.fits = Object.fromEntries(shortlist.map((s, i) => [s.id, +fits[i]!.toFixed(2)]));
  if (trace && a2.which?.type === 'choice') trace.pick = Object.fromEntries(Object.entries(a2.which.probabilities ?? {}).map(([k, p]) => [shortlist[Number(k.slice(1))]?.id, +p.toFixed(2)]));
  const w = a2.which;
  const pick = w?.type === 'choice' ? Number(w.choice.slice(1)) : -1;
  // The chosen skill must fit; if it doesn't, the candidate that fits best may stand in.
  if ((fits[pick] ?? 0) >= FITS) return shortlist[pick]?.id ?? null;
  const best = fits.indexOf(Math.max(...fits));
  return fits[best]! >= FITS ? (shortlist[best]?.id ?? null) : null;
}

/**
 * Cookbook wording: ignorable, because a confident wrong suggestion is worse than none.
 * Unlike the cookbook, no match sends nothing: Claude Code's own listing may hold skills this roster
 * lacks, so "nothing is relevant" could talk Claude out of one that fits.
 */
export function block(id: string): string {
  return `<skill_relevance>\nRelevant to the current request: ${id}. Ignore this if it does not fit what the user actually asked for.\n</skill_relevance>`;
}

/** Slash commands and skill invocations already name what they want; tiny replies ("go", "yes") need no skill. */
export function skip(prompt: string): boolean {
  const p = prompt.trim();
  return p.length < 12 || p.startsWith('/') || p.includes('<command-name>');
}

if (import.meta.main) {
  try {
    const input = JSON.parse((await Bun.stdin.text()) || '{}') as { prompt?: string; cwd?: string; transcript_path?: string };
    const prompt = input.prompt ?? '';
    if (jevKey() && !skip(prompt)) {
      const started = performance.now();
      const recent = await recentContext(input.transcript_path, prompt);
      const id = await suggest(prompt, loadRoster(input.cwd ?? process.cwd()), AbortSignal.timeout(TIMEOUT_MS), undefined, recent);
      if (process.env.SKILL_SUGGEST_DEBUG) process.stderr.write(`skill-suggest: ${id ?? 'none'} in ${Math.round(performance.now() - started)} ms\n`);
      if (id) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: block(id) } }));
    }
  } catch (e) {
    // Never block or slow a turn: on any failure, say nothing.
    if (process.env.SKILL_SUGGEST_DEBUG) process.stderr.write(`skill-suggest failed: ${(e as Error).message}\n`);
  }
}
