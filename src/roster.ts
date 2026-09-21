/** Reads every skill Claude Code can load: personal, project and enabled plugins' skills. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BUILTINS } from './builtins';

export interface Skill {
  /** The name the Skill tool takes: `name` or `plugin:name`. */
  id: string;
  description: string;
  /** Opening of the SKILL.md body, for the second, closer look. */
  body: string;
}

/** Minimal frontmatter reader: `name`, and `description` in plain, quoted or folded (`>`/`|`) form. */
export function parseSkill(text: string): { name?: string; description: string; body: string } {
  const src = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
  if (!m) return { description: '', body: src };
  const [, front, body] = m;
  const lines = front!.split('\n');
  const field = (key: string): string | undefined => {
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i < 0) return undefined;
    const parts = [lines[i]!.slice(key.length + 1).trim()];
    for (let j = i + 1; j < lines.length && /^\s+\S|^$/.test(lines[j]!); j++) parts.push(lines[j]!.trim());
    return parts
      .filter((p) => p && p !== '>' && p !== '|' && p !== '>-' && p !== '|-')
      .join(' ')
      .replace(/^(["'])([\s\S]*)\1$/, '$2')
      .trim();
  };
  return { name: field('name'), description: field('description') ?? '', body: body!.trim() };
}

function readDir(dir: string, prefix: string): Skill[] {
  if (!existsSync(dir)) return [];
  const out: Skill[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    try {
      const s = parseSkill(readFileSync(file, 'utf8'));
      if (!s.description) continue;
      out.push({ id: prefix + (s.name || entry.name), description: s.description, body: s.body });
    } catch {}
  }
  return out;
}

export function loadRoster(cwd: string, config = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')): Skill[] {
  const skills = [...readDir(join(config, 'skills'), ''), ...readDir(join(cwd, '.claude', 'skills'), '')];
  try {
    const enabled = JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).enabledPlugins ?? {};
    const installed = JSON.parse(readFileSync(join(config, 'plugins', 'installed_plugins.json'), 'utf8')).plugins ?? {};
    for (const [key, on] of Object.entries(enabled)) {
      if (!on) continue;
      const path = installed[key]?.[0]?.installPath;
      if (path) skills.push(...readDir(join(path, 'skills'), `${key.split('@')[0]}:`));
    }
  } catch {}
  skills.push(...BUILTINS);
  const seen = new Set<string>();
  return skills.filter((s) => !seen.has(s.id) && seen.add(s.id));
}
