/** The six stash tools: their schemas and handlers. Every handler returns the text the agent will see. */
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { runCode, runShell, type Language } from './exec';
import { bytes, type Hit, type Store } from './store';
import { ask, jevKey, noul, type Question } from '../jev';

/** ~3,000 tokens at chars/4. */
export const BUDGET = 12_000;
const CODE_CAP = 4_000;
const HIT_CAP = 2_000;
const RERANK_POOL = 15;
const JEV_BATCH = 40;

const n = (x: number) => x.toLocaleString('en-US');

export function lineCount(s: string): number {
  return s ? s.split('\n').length - (s.endsWith('\n') ? 1 : 0) : 0;
}

/** At most `head + tail` lines, with the gap marked. */
export function preview(s: string, head = 8, tail = 6): string {
  const lines = s.replace(/\n$/, '').split('\n').map((l) => (l.length > 300 ? l.slice(0, 300) + '…' : l));
  if (lines.length <= head + tail + 1) return lines.join('\n');
  return [...lines.slice(0, head), `… ${lines.length - head - tail} lines omitted …`, ...lines.slice(-tail)].join('\n');
}

/** Joins blocks until `max` chars, then says what was cut and how to get it. */
export function assemble(blocks: string[], max: number, hint: string): string {
  let out = '';
  let i = 0;
  for (; i < blocks.length; i++) {
    const b = (out ? '\n\n' : '') + blocks[i];
    if (out.length + b.length > max - 200) break;
    out += b;
  }
  if (i === blocks.length) return out;
  if (!out) {
    out = blocks[0]!.slice(0, max - 200);
    i = 1;
  }
  return `${out}\n\n[… ${blocks.length - i} more block(s) cut to stay under ~${n(max / 4)} tokens — ${hint}]`;
}

function formatHit(h: Hit): string {
  const where = `--- [${h.label}] c${h.id} L${h.lineStart}-${h.lineEnd}${h.heading ? ` § ${h.heading}` : ''}`;
  const text = h.text.length > HIT_CAP ? `${h.text.slice(0, HIT_CAP)}\n[… ${n(h.text.length - HIT_CAP)} chars more: stash_get c${h.id}]` : h.text;
  return `${where}\n${text}`;
}

// ---- TypeSafe Jev rerank ----

async function jevScores(query: string, hits: Hit[]): Promise<number[]> {
  const scores: number[] = [];
  for (let i = 0; i < hits.length; i += JEV_BATCH) {
    const batch = hits.slice(i, i + JEV_BATCH);
    const questions: Record<string, Question> = Object.fromEntries(
      batch.map((_, j) => [
        `p${j}`,
        {
          type: 'noul',
          instructions: `Does \`passages[${j}]\` contain information that helps answer \`query\`?`,
          criteria: {
            true: 'The passage states facts, code, errors or steps directly relevant to the query',
            false: 'The passage is unrelated or only shares words with the query',
          },
        },
      ]),
    );
    const state = { query, passages: batch.map((h) => ({ id: `c${h.id}`, heading: h.heading, text: h.text.slice(0, 1500) })) };
    const answers = await ask(state, questions, AbortSignal.timeout(8_000));
    batch.forEach((_, j) => scores.push(noul(answers[`p${j}`])));
  }
  return scores;
}

/** Keeps hits Jev rates close to the best one; any failure falls back to BM25 order. */
export async function rerank(query: string, hits: Hit[]): Promise<Hit[]> {
  if (!jevKey() || hits.length < 2) return hits;
  try {
    const scores = await jevScores(query, hits);
    const floor = Math.max(0.3, 0.5 * Math.max(...scores));
    return hits
      .map((h, i) => ({ h, s: scores[i]! }))
      .filter((x) => x.s >= floor)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.h);
  } catch (e) {
    process.stderr.write(`stash: Jev rerank failed (${(e as Error).message}), keeping BM25 order\n`);
    return hits;
  }
}

async function searchBlocks(store: Store, queries: string[], limit: number, sources?: string[]): Promise<string[]> {
  const pool = jevKey() ? Math.max(limit, RERANK_POOL) : limit;
  const ranked = await Promise.all(queries.map(async (q) => (await rerank(q, store.search(q, pool, sources))).slice(0, limit)));
  const seen = new Set<number>();
  const blocks: string[] = [];
  queries.forEach((q, i) => {
    const hits = ranked[i]!;
    blocks.push(`### "${q}" — ${hits.length ? `${hits.length} hit(s)` : 'no matches'}`);
    for (const h of hits) {
      blocks.push(seen.has(h.id) ? `--- c${h.id} (shown above)` : formatHit(h));
      seen.add(h.id);
    }
  });
  return blocks;
}

// ---- input checks ----

type Args = Record<string, unknown>;
const str = (a: Args, k: string, required = true): string | undefined => {
  const v = a[k];
  if (v === undefined && !required) return undefined;
  if (typeof v !== 'string' || (required && !v)) throw new Error(`\`${k}\` must be a non-empty string`);
  return v;
};
const num = (a: Args, k: string, def: number): number => {
  const v = a[k];
  if (v === undefined) return def;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`\`${k}\` must be a non-negative number`);
  return v;
};
const strings = (a: Args, k: string): string[] | undefined => {
  const v = a[k];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error(`\`${k}\` must be an array of strings`);
  return v as string[];
};

// ---- URL fetching ----

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-3])\b[^>]*>/gi, (_, l: string) => `\n\n${'#'.repeat(Number(l))} `)
    .replace(/<\/h[1-6]>|<\/p>|<br\s*\/?>|<\/div>|<\/tr>|<\/li>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchUrl(url: string): Promise<string> {
  const key = process.env.JINA_API_KEY;
  if (key) {
    const res = await fetch('https://r.jina.ai/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Retain-Images': 'none',
        'X-Retain-Links': 'text',
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
    const content = ((await res.json()) as { data?: { content?: string } }).data?.content;
    if (typeof content !== 'string') throw new Error('Jina returned no content');
    return content;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.text();
  return /html/i.test(res.headers.get('content-type') ?? '') ? htmlToText(body) : body;
}

// ---- tools ----

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Args) => Promise<string>;
}

export function tools(store: Store): Tool[] {
  return [
    {
      name: 'stash_run',
      description:
        'Run shell commands in parallel with their output kept out of context: each output is stored and indexed, and you get exit code, size and a ~15-line preview. Pass `queries` to also get the passages that match them. Use instead of Bash for anything that may print more than ~50 lines (logs, test runs, git log, builds, listings).',
      inputSchema: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            items: { type: 'object', properties: { label: { type: 'string' }, command: { type: 'string' } }, required: ['label', 'command'] },
          },
          queries: { type: 'array', items: { type: 'string' }, description: 'What you want to find in the output.' },
          cwd: { type: 'string' },
          timeoutSec: { type: 'number', description: 'Per command, default 60.' },
        },
        required: ['commands'],
      },
      handler: async (a) => {
        const cmds = a.commands;
        if (!Array.isArray(cmds) || !cmds.length) throw new Error('`commands` must be a non-empty array');
        const list = cmds.map((c: Args) => ({ label: str(c, 'label')!, command: str(c, 'command')! }));
        const queries = strings(a, 'queries');
        const cwd = resolve(str(a, 'cwd', false) ?? process.cwd());
        const timeout = num(a, 'timeoutSec', 60);
        const results = await Promise.all(list.map((c) => runShell(c.command, cwd, timeout)));
        const ids: string[] = [];
        const blocks = results.map((r, i) => {
          const { label } = list[i]!;
          const { id, chunks } = store.add(label, 'command', r.output, false);
          ids.push(id);
          const status = r.timedOut ? `timed out after ${timeout} s` : `exit ${r.exitCode}`;
          return `## [${label}] ${status} · ${n(bytes(r.output))} B · ${lineCount(r.output)} lines · ${id} (${chunks.length} chunks)\n${preview(r.output) || '(no output)'}`;
        });
        if (queries?.length) blocks.push(...(await searchBlocks(store, queries, 5, ids)));
        return assemble(blocks, BUDGET, `use stash_search or stash_get <id> for the rest`);
      },
    },
    {
      name: 'stash_code',
      description:
        'Run a JavaScript/TypeScript (bun), Python or shell snippet and get back only what it prints (capped at 4,000 chars; the full output is stored). Use it to filter, count or parse large data so only the answer enters context.',
      inputSchema: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['javascript', 'typescript', 'python', 'shell'] },
          code: { type: 'string' },
          timeoutSec: { type: 'number', description: 'Default 60.' },
        },
        required: ['language', 'code'],
      },
      handler: async (a) => {
        const language = str(a, 'language') as Language;
        if (!['javascript', 'typescript', 'python', 'shell'].includes(language)) throw new Error('unsupported `language`');
        const r = await runCode(language, str(a, 'code')!, num(a, 'timeoutSec', 60));
        const { id } = store.add(`code:${language}`, 'code', r.output, false);
        const status = r.timedOut ? '[timed out]\n' : r.exitCode ? `[exit ${r.exitCode}]\n` : '';
        if (r.output.length <= CODE_CAP) return status + (r.output || '(no output)');
        const head = r.output.slice(0, CODE_CAP - 1000);
        const tail = r.output.slice(-800);
        return `${status}${head}\n[… ${n(r.output.length - head.length - tail.length)} chars omitted; full output: stash_get ${id} …]\n${tail}`;
      },
    },
    {
      name: 'stash_index',
      description:
        'Store and index a text file (`path`), a web page (`url`) or text you already have (`text` + `label`) without reading it into context. Returns the source id, size and headings; then use stash_search or stash_get.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, url: { type: 'string' }, text: { type: 'string' }, label: { type: 'string' } },
      },
      handler: async (a) => {
        const given = ['path', 'url', 'text'].filter((k) => a[k] !== undefined);
        if (given.length !== 1) throw new Error('pass exactly one of `path`, `url` or `text`');
        let content: string;
        let label: string;
        let kind: string;
        let markdown = true;
        if (a.path !== undefined) {
          label = resolve(str(a, 'path')!);
          const buf = readFileSync(label);
          if (buf.subarray(0, 8192).includes(0)) throw new Error(`${label} looks binary`);
          content = buf.toString('utf8');
          kind = 'file';
          markdown = ['.md', '.mdx', '.markdown'].includes(extname(label).toLowerCase());
        } else if (a.url !== undefined) {
          label = str(a, 'url')!;
          if (!/^https?:\/\//i.test(label)) throw new Error('`url` must be http(s)');
          content = await fetchUrl(label);
          kind = 'url';
        } else {
          content = str(a, 'text')!;
          label = str(a, 'label', false) || 'text';
          kind = 'text';
        }
        const { id, chunks } = store.add(label, kind, content, markdown);
        const headings = [...new Set(chunks.map((c) => c.heading).filter(Boolean))];
        const shown = headings.slice(0, 30).map((h) => `- ${h}`).join('\n');
        return `${id} · ${label} · ${n(bytes(content))} B · ${lineCount(content)} lines · ${chunks.length} chunks${
          headings.length ? `\nHeadings${headings.length > 30 ? ` (30 of ${headings.length})` : ''}:\n${shown}` : ''
        }`;
      },
    },
    {
      name: 'stash_search',
      description:
        'Full-text search over everything stashed in this project (command outputs, files, pages). Pass all your questions at once in `queries`; returns the matching passages with ids and line ranges.',
      inputSchema: {
        type: 'object',
        properties: {
          queries: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', description: 'Hits per query, default 5.' },
          source: { type: 'string', description: 'Limit to one source, by id or label.' },
        },
        required: ['queries'],
      },
      handler: async (a) => {
        const queries = strings(a, 'queries');
        if (!queries?.length) throw new Error('`queries` must be a non-empty array of strings');
        const ref = str(a, 'source', false);
        const sources = ref ? store.resolve(ref) : undefined;
        if (ref && !sources!.length) return `No source "${ref}" in this project.`;
        const blocks = await searchBlocks(store, queries, Math.max(1, Math.floor(num(a, 'limit', 5))), sources);
        return assemble(blocks, BUDGET, 'narrow the query, lower `limit`, or stash_get a chunk id');
      },
    },
    {
      name: 'stash_get',
      description:
        'Read a stored chunk (`c123`) or a whole source (`s…`) exactly as stored, paged by character offset. Use when a preview or search hit is not enough.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, offset: { type: 'number' }, maxChars: { type: 'number', description: 'Default 12000.' } },
        required: ['id'],
      },
      handler: async (a) => {
        const id = str(a, 'id')!;
        const p = store.page(id, Math.floor(num(a, 'offset', 0)), Math.floor(num(a, 'maxChars', 12_000)));
        if (!p) return `No chunk or source with id "${id}".`;
        return p.next === null ? p.text : `${p.text}\n[… more: stash_get {"id":"${id}","offset":${p.next}} (${n(p.next)} of ${n(p.total)} chars)]`;
      },
    },
    {
      name: 'stash_stats',
      description: 'How many bytes stash stored versus returned into context, this session and all-time.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const t = store.totals();
        const line = (label: string, s: number, r: number) =>
          `${label}: stored ${n(s)} B, returned ${n(r)} B${s ? ` (${((100 * r) / s).toFixed(1)}% of stored)` : ''}`;
        return [
          line('This session', store.session.stored, store.session.returned),
          line('All time', t.stored, t.returned),
          `This project: ${t.sources} sources, ${n(t.sourceBytes)} B (sources older than 7 days are pruned)`,
        ].join('\n');
      },
    },
  ];
}
