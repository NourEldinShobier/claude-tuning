#!/usr/bin/env bun
/**
 * PostToolUse hook on Bash and PowerShell: replaces long command output with a squeezed version
 * before Claude reads it. The command itself runs untouched, so exit codes and quoting are exactly
 * as written. The full output is saved to a file named in the result, so nothing is lost.
 * Opt out per command by including `SQUEEZE=0` in it; globally with env SQUEEZE=0.
 */
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { IMPORTANT, clean, lines, squeeze, type Kind } from './filters';
import { ask, jevKey, noul, type Question } from '../jev';

/** Below this many characters (~600 tokens) output is left alone. */
const MIN_CHARS = 2_500;
/** A squeeze that saves less than this share is not worth the extra note. */
const MIN_SAVING = 0.2;
/** Generic output larger than this gets Jev to pick the relevant middle blocks. */
const JEV_OVER = 12_000;
const BLOCK_LINES = 25;
const JEV_BUDGET = 5_000;

interface BashResponse {
  stdout?: string;
  stderr?: string;
  isImage?: boolean;
  [k: string]: unknown;
}

export const logDir = () => process.env.SQUEEZE_DIR || join(homedir(), '.cache', 'claude-tuning', 'squeeze');

function saveFull(stdout: string, stderr: string): string {
  const dir = logDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${Bun.hash(stdout + stderr).toString(36)}.log`);
  writeFileSync(file, stderr ? `${stdout}\n\n--- stderr ---\n${stderr}` : stdout);
  // ponytail: prune on ~5% of calls; a size cap if the folder ever grows large.
  if (Math.random() < 0.05) {
    const cutoff = Date.now() - 2 * 86_400_000;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      try {
        if (statSync(p).mtimeMs < cutoff) unlinkSync(p);
      } catch {}
    }
  }
  return file;
}

/** For big output no rule understands: head, tail, and the middle blocks Jev judges relevant to the command's purpose. */
export async function jevMiddle(text: string, purpose: string, signal: AbortSignal): Promise<string | null> {
  const ls = lines(text);
  const head = ls.slice(0, 40);
  const tail = ls.slice(-30);
  const middle = ls.slice(40, -30);
  const blocks: string[][] = [];
  for (let i = 0; i < middle.length; i += BLOCK_LINES) blocks.push(middle.slice(i, i + BLOCK_LINES));
  if (blocks.length < 2) return null;
  // At most 40 questions in one request; sample evenly when there are more blocks.
  const step = Math.max(1, Math.ceil(blocks.length / 40));
  const asked = blocks.map((b, i) => ({ b, i })).filter((_, i) => i % step === 0);
  const questions: Record<string, Question> = {};
  asked.forEach((_, k) => {
    questions[`b${k}`] = {
      type: 'noul',
      instructions: `Does \`blocks[${k}]\` contain information someone running this command needs, given \`purpose\`?`,
      criteria: { true: 'It holds errors, results, values, names or lines the purpose asks about', false: 'Routine progress, repeated boilerplate, or unrelated detail' },
    };
  });
  const answers = await ask({ purpose, blocks: asked.map((a) => a.b.join('\n').slice(0, 1500)) }, questions, signal);
  const scored = asked.map((a, k) => ({ ...a, s: noul(answers[`b${k}`]) })).filter((a) => a.s >= 0.5).sort((x, y) => y.s - x.s);
  const chosen: typeof scored = [];
  let size = 0;
  for (const a of scored) {
    const n = a.b.join('\n').length;
    if (size + n > JEV_BUDGET) continue;
    chosen.push(a);
    size += n;
  }
  chosen.sort((x, y) => x.i - y.i);
  const errors = middle.filter((l) => IMPORTANT.test(l)).slice(0, 20);
  const parts = [head.join('\n'), `… ${middle.length} middle lines; ${chosen.length} of ${blocks.length} blocks kept as relevant to "${purpose}" …`];
  for (const c of chosen) parts.push(`[lines ${40 + c.i * BLOCK_LINES + 1}–${40 + c.i * BLOCK_LINES + c.b.length}]\n${c.b.join('\n')}`);
  if (errors.length) parts.push(`[error/warning lines elsewhere]\n${errors.join('\n')}`);
  parts.push('…', tail.join('\n'));
  return parts.join('\n');
}

export async function squeezeResult(command: string, description: string | undefined, r: BashResponse, signal: AbortSignal): Promise<BashResponse | null> {
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';
  const before = stdout.length + stderr.length;
  if (r.isImage || before < MIN_CHARS) return null;
  if (/\bSQUEEZE=0\b/.test(command)) return null;

  let out = squeeze(stdout, command);
  let kind: Kind | 'jev' = out.kind;
  if (out.kind === 'generic' && clean(stdout).length > JEV_OVER && jevKey() && description) {
    const picked = await jevMiddle(clean(stdout), description, signal).catch(() => null);
    if (picked) (out = { text: picked, kind: 'generic' }), (kind = 'jev');
  }
  const err = stderr.length > MIN_CHARS ? squeeze(stderr, command).text : clean(stderr);
  const after = out.text.length + err.length;
  if (after > before * (1 - MIN_SAVING)) return null;

  const file = saveFull(stdout, stderr);
  const note = `\n[squeeze (${kind}): ${before.toLocaleString('en-US')} → ${after.toLocaleString('en-US')} chars. Full output: ${file} — Read it for anything cut, or rerun with SQUEEZE=0 in the command.]`;
  return { ...r, stdout: `${out.text}${note}`, stderr: err };
}

if (import.meta.main) {
  try {
    if (process.env.SQUEEZE === '0') process.exit(0);
    const event = JSON.parse((await Bun.stdin.text()) || '{}') as { tool_input?: { command?: string; description?: string }; tool_response?: BashResponse };
    const r = event.tool_response;
    if (!r || typeof r !== 'object') process.exit(0);
    const next = await squeezeResult(event.tool_input?.command ?? '', event.tool_input?.description, r, AbortSignal.timeout(4_000));
    if (next) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: next } }));
  } catch (e) {
    // Never break a command's result: on any failure, Claude gets the original output.
    if (process.env.SQUEEZE_DEBUG) process.stderr.write(`squeeze failed: ${(e as Error).message}\n`);
  }
}
