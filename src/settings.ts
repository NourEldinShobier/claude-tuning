/** The settings this setup writes into ~/.claude/settings.json, and a merge that keeps everything else. */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const configDir = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
export const settingsPath = () => join(configDir(), 'settings.json');

export interface Settings {
  env?: Record<string, string>;
  hooks?: Record<string, { matcher?: string; hooks: { type: string; command: string; args?: string[]; timeout?: number }[] }[]>;
  [k: string]: unknown;
}

/** Tuning that is not code: the auto-compact window, the ponytail exemption and the code-graph hooks. */
export function desired(has: { rtk: boolean; codebaseMemory: boolean }): Settings {
  const env: Record<string, string> = {
    // web-search's researcher agent gets no ponytail rules: it writes no code, and they cost ~1.4k tokens.
    PONYTAIL_SUBAGENT_MATCHER: '^(?!web-search:web-researcher$)',
  };
  const hooks: Settings['hooks'] = {};
  if (has.rtk) hooks.PreToolUse = [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'rtk hook claude' }] }];
  if (has.codebaseMemory) {
    const cbm = (matcher: string) => ({ matcher, hooks: [{ type: 'command', command: 'codebase-memory-mcp', args: ['hook-augment'], timeout: 5 }] });
    hooks.SessionStart = ['startup', 'resume', 'clear', 'compact'].map(cbm);
    hooks.PreToolUse = [...(hooks.PreToolUse ?? []), cbm('Grep|Glob|Bash')];
    hooks.PostToolUse = [cbm('Read')];
    hooks.SubagentStart = [cbm('*')];
  }
  return { env, hooks, autoCompactWindow: 700_000 };
}

type Entry = { matcher?: string; hooks?: { command?: string; args?: string[] }[] };

/** The command's name without directory, extension or quotes: an absolute path to the same tool counts as the same hook. */
export const commandName = (command = '') =>
  command
    .trim()
    .replace(/^["']|["']$/g, '')
    .split(/\s+/)[0]!
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/\.(exe|cmd|bat|mjs|js)$/i, '');

/** Same event entry: same matcher and the same tools, however each one spells their paths. */
const sameHook = (a: Entry, b: Entry) =>
  (a.matcher ?? '') === (b.matcher ?? '') &&
  JSON.stringify((a.hooks ?? []).map((h) => [commandName(h.command), h.args ?? []])) === JSON.stringify((b.hooks ?? []).map((h) => [commandName(h.command), h.args ?? []]));

/** Adds what is missing; never removes or reorders what is already there. Returns the merged settings and what changed. */
export function merge(current: Settings, want: Settings): { next: Settings; changes: string[] } {
  const next: Settings = { ...current };
  const changes: string[] = [];

  next.env = { ...current.env };
  for (const [k, v] of Object.entries(want.env ?? {})) {
    if (next.env[k] === v) continue;
    changes.push(`env.${k}: ${next.env[k] === undefined ? 'unset' : next.env[k]} -> ${v}`);
    next.env[k] = v;
  }

  if (want.autoCompactWindow && current.autoCompactWindow !== want.autoCompactWindow) {
    changes.push(`autoCompactWindow: ${current.autoCompactWindow ?? 'unset'} -> ${want.autoCompactWindow}`);
    next.autoCompactWindow = want.autoCompactWindow;
  }

  next.hooks = { ...current.hooks };
  for (const [event, entries] of Object.entries(want.hooks ?? {})) {
    const existing = next.hooks[event] ?? [];
    const missing = entries.filter((e) => !existing.some((x) => sameHook(x, e)));
    if (!missing.length) continue;
    changes.push(`hooks.${event}: +${missing.length}`);
    next.hooks[event] = [...existing, ...missing];
  }
  return { next, changes };
}

export function readSettings(path = settingsPath()): Settings {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Settings;
  } catch (e) {
    throw new Error(`${path} is not valid JSON (${(e as Error).message}). Fix it first: a broken settings file disables every setting in it.`);
  }
}

export const claudeMdPath = () => join(configDir(), 'CLAUDE.md');
const START = '<!-- claude-tuning:start -->';
const END = '<!-- claude-tuning:end -->';

/** CLAUDE.md with our rules block added, or replaced in place if an earlier version is there. Everything else is kept. */
export function withRules(current: string, rules: string): string {
  const block = `${START}\n${rules.trim()}\n${END}`;
  const s = current.indexOf(START);
  const e = current.indexOf(END);
  if (s >= 0 && e > s) return current.slice(0, s) + block + current.slice(e + END.length);
  return current.trim() ? `${current.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

/** Writes settings.json, keeping a .bak of what was there. */
export function writeSettings(next: Settings, path = settingsPath()): void {
  if (existsSync(path)) copyFileSync(path, `${path}.bak`);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
}
