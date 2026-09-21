/**
 * UserPromptSubmit hook: suggests at most one skill for the turn, with TypeSafe Jev.
 * Two requests, following TypeSafe's skill-suggestion cookbook (docs.typesafe.ai/cookbooks/skill_suggestion):
 * 1. rank every skill and ask whether the request needs one at all;
 * 2. re-read the top three with their SKILL.md openings, free to reject all of them.
 * Output is one ignorable line added to the turn (nothing when no skill fits), so Claude Code's cached prefix is untouched.
 */
import { loadRoster, type Skill } from './roster';

const SHORTLIST = 3;
const EXCERPT = 700;
const GATE = 0.3;
/** Cookbook uses 0.30; on this roster right picks scored 0.86+ and needless ones 0.50-0.52 (test/eval.ts). */
const FITS = 0.6;
const TIMEOUT_MS = 4_000;

type Question = { type: 'noul'; instructions: string } | { type: 'choice'; instructions: string; criteria: Record<string, string> };
type Answer = { type: 'noul'; noul: number } | { type: 'choice'; choice: string; probabilities?: Record<string, number> };

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

async function ask(state: unknown, questions: Record<string, Question>, signal: AbortSignal): Promise<Record<string, Answer | undefined>> {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal,
  });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  return ((await res.json()) as { answers?: Record<string, Answer> }).answers ?? {};
}

/** Option keys must be plain; skill ids contain ':' and '-'. */
const key = (i: number) => `s${i}`;

export async function suggest(request: string, roster: Skill[], signal: AbortSignal, trace?: Record<string, unknown>): Promise<string | null> {
  if (!roster.length) return null;
  const state = { request, recent_context: '' };

  // 1. Wide: rank everything, and gate on whether a skill is wanted at all.
  const wide: Record<string, Question> = {
    which: {
      type: 'choice',
      instructions: "Which of these skills, if any, is the right one to load to help with the user's latest request?",
      criteria: Object.fromEntries(roster.map((s, i) => [key(i), `${s.id}: ${s.description.slice(0, 300)}`])),
    },
  };
  for (const [k, text] of Object.entries(GATE_QUESTIONS)) wide[`gate_${k}`] = { type: 'noul', instructions: text };
  const a1 = await ask(state, wide, signal);
  const gates = Object.keys(GATE_QUESTIONS).map((k) => {
    const a = a1[`gate_${k}`];
    const v = a?.type === 'noul' ? a.noul : 0;
    return INVERTED.has(k) ? 1 - v : v;
  });
  const gate = gates.reduce((x, y) => x + y, 0) / gates.length;
  if (trace) trace.gate = +gate.toFixed(2);
  if (gate < GATE) return null;
  const which = a1.which;
  if (which?.type !== 'choice') return null;
  const shortlist = Object.entries(which.probabilities ?? { [which.choice]: 1 })
    .sort((x, y) => y[1] - x[1])
    .slice(0, SHORTLIST)
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
  const w = a2.which;
  const pick = w?.type === 'choice' ? Number(w.choice.slice(1)) : -1;
  // The chosen skill itself must fit, not just some candidate.
  return (fits[pick] ?? 0) >= FITS ? (shortlist[pick]?.id ?? null) : null;
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
    const input = JSON.parse((await Bun.stdin.text()) || '{}') as { prompt?: string; cwd?: string };
    const prompt = input.prompt ?? '';
    if (process.env.TYPESAFE_API_KEY && !skip(prompt)) {
      const started = performance.now();
      const id = await suggest(prompt, loadRoster(input.cwd ?? process.cwd()), AbortSignal.timeout(TIMEOUT_MS));
      if (process.env.SKILL_SUGGEST_DEBUG) process.stderr.write(`skill-suggest: ${id ?? 'none'} in ${Math.round(performance.now() - started)} ms\n`);
      if (id) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: block(id) } }));
    }
  } catch (e) {
    // Never block or slow a turn: on any failure, say nothing.
    if (process.env.SKILL_SUGGEST_DEBUG) process.stderr.write(`skill-suggest failed: ${(e as Error).message}\n`);
  }
}
