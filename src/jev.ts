/** Minimal TypeSafe Jev client (https://docs.typesafe.ai/api), shared by every hook here. */

import { execFile } from 'node:child_process';

export type Question =
  | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> };

export type Answer = { type: 'noul'; noul: number } | { type: 'choice'; choice: string; probabilities?: Record<string, number> };

/** Splits a command line on whitespace, keeping quoted text together. No shell, no escapes (Windows paths keep their backslashes). */
export function splitArgv(line: string): string[] {
  const argv: string[] = [];
  let cur = '';
  let started = false;
  let quote = '';
  for (const c of line) {
    if (quote) {
      if (c === quote) quote = '';
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) {
      if (started) argv.push(cur);
      cur = '';
      started = false;
    } else {
      cur += c;
      started = true;
    }
  }
  if (started) argv.push(cur);
  return argv;
}

/** Key from TYPESAFE_API_KEY, else from the stdout of TYPESAFE_API_KEY_COMMAND. Any failure gives undefined; the key is never logged. */
export async function resolveKey(env: Record<string, string | undefined> = process.env, timeoutMs = 3_000): Promise<string | undefined> {
  if (env.TYPESAFE_API_KEY) return env.TYPESAFE_API_KEY;
  const [file, ...args] = splitArgv(env.TYPESAFE_API_KEY_COMMAND ?? '');
  if (!file) return undefined;
  return new Promise((resolve) => {
    try {
      execFile(file, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 65536, encoding: 'utf8' }, (err, stdout) => {
        const key = err ? '' : (stdout.trim().split('\n')[0] ?? '').trim();
        resolve(key && key.length <= 4096 ? key : undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

let cached: Promise<string | undefined> | undefined;
/** Resolved once per process. */
export const jevKey = () => (cached ??= resolveKey());

export async function ask(state: unknown, questions: Record<string, Question>, signal: AbortSignal): Promise<Record<string, Answer | undefined>> {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await jevKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal,
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`Jev HTTP ${res.status}`);
  }
  return ((await res.json()) as { answers?: Record<string, Answer> }).answers ?? {};
}

export const noul = (a: Answer | undefined, fallback = 0) => (a?.type === 'noul' ? a.noul : fallback);
