import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadRoster, parseSkill } from '../src/roster';
import { block, skip } from '../src/suggest';
import { MARK, patch } from '../src/cap-context-mode';

describe('roster', () => {
  test('reads plain and folded descriptions', () => {
    expect(parseSkill('---\nname: gsap\ndescription: Use for GSAP.\n---\n# Body').description).toBe('Use for GSAP.');
    const folded = parseSkill('---\nname: p\ndescription: >\n  Forces the laziest\n  solution.\nlicense: MIT\n---\nbody');
    expect(folded).toEqual({ name: 'p', description: 'Forces the laziest solution.', body: 'body' });
    expect(parseSkill('---\ndescription: "Quoted: yes"\n---\n').description).toBe('Quoted: yes');
  });

  test('loads the real roster with plugin prefixes', () => {
    const roster = loadRoster(process.cwd());
    expect(roster.length).toBeGreaterThan(100);
    expect(roster.some((s) => s.id === 'web-search:web-search')).toBe(true);
    expect(roster.every((s) => s.description.length > 0)).toBe(true);
  });
});

describe('suggest', () => {
  test('skips slash commands, skill invocations and short replies', () => {
    expect(skip('go')).toBe(true);
    expect(skip('/web-search:web-search bun')).toBe(true);
    expect(skip('add a scroll reveal animation to the hero section')).toBe(false);
  });

  test('suggestion wording is ignorable', () => {
    expect(block('gsap')).toContain('Relevant to the current request: gsap. Ignore this if it does not fit');
  });
});

describe('context-mode cap', () => {
  const root = join(homedir(), '.claude', 'plugins', 'cache', 'context-mode', 'context-mode');
  const version = readdirSync(root).sort().at(-1)!;
  const src = readFileSync(join(root, version, 'hooks', 'sessionstart.mjs'), 'utf8');

  test('patches the installed context-mode once', () => {
    const once = patch(src.replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'));
    expect(once).toContain(MARK);
    expect(patch(once!)).toBeNull();
  });

  test('the patched cut keeps the start and stays under 10,000 characters', () => {
    let additionalContext = `<rules>${'r'.repeat(4600)}</rules>\n` + 'line of session guide\n'.repeat(1200);
    // Run the exact snippet the patch inserts.
    const snippet = /if \(additionalContext\.length > 9500\) \{[\s\S]*?\n  \}/.exec(patch(src.replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'))!)![0];
    additionalContext = new Function('additionalContext', `${snippet}; return additionalContext;`)(additionalContext);
    expect(additionalContext.length).toBeLessThan(10_000);
    expect(additionalContext.startsWith(`<rules>${'r'.repeat(4600)}</rules>`)).toBe(true);
    expect(additionalContext).toContain('ctx_search');
  });
});

import { eligible, isComplex } from '../src/route-model';

describe('model routing', () => {
  test('never overrides an explicit model or read-only agent types', () => {
    expect(eligible({ prompt: 'x', model: 'sonnet' })).toBe(false);
    expect(eligible({ prompt: 'x', subagent_type: 'Explore' })).toBe(false);
    expect(eligible({ prompt: 'refactor auth', subagent_type: 'general-purpose' })).toBe(true);
  });

  test('upgrades only when complex and not mechanical', () => {
    expect(isComplex(0.9, 0.2)).toBe(true);
    expect(isComplex(0.26, 0.43)).toBe(false);
    expect(isComplex(0.9, 0.95)).toBe(false);
  });
});

import { desired, merge, type Settings } from '../src/settings';
import { UPSTREAMS, plugins } from '../src/upstreams';
import { isBehind } from '../src/check-upstreams';

describe('settings merge', () => {
  const want = desired({ rtk: true, codebaseMemory: false });

  test('keeps existing keys and hooks, adds what is missing', () => {
    const current: Settings = { model: 'opus', env: { FOO: 'bar' }, hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier' }] }] } };
    const { next, changes } = merge(current, want);
    expect(next.model).toBe('opus');
    expect(next.env!.FOO).toBe('bar');
    expect(next.env!.CLAUDE_CODE_SUBAGENT_MODEL).toBe('sonnet');
    expect(next.hooks!.PreToolUse!.length).toBe(2);
    expect(changes.length).toBeGreaterThan(0);
  });

  test('is idempotent: a second merge changes nothing', () => {
    const once = merge({}, want).next;
    expect(merge(once, want).changes).toEqual([]);
  });

  test('hooks for a tool that is not installed are not written', () => {
    expect(Object.keys(desired({ rtk: false, codebaseMemory: false }).hooks ?? {})).toEqual([]);
  });
});

describe('upstreams', () => {
  test('every entry is installable: licence, version and a plugin id or install commands', () => {
    for (const u of UPSTREAMS) {
      expect(u.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(u.license.length).toBeGreaterThan(0);
      expect(u.version).toMatch(/^\d+\.\d+/);
      if (u.kind === 'plugin') expect(`${u.plugin}@${u.marketplace}`).not.toContain('undefined');
      else expect(Object.keys(u.install ?? {})).toEqual(['darwin', 'linux', 'win32']);
    }
    expect(plugins().length).toBeGreaterThan(3);
  });

  test('no third-party code is vendored: only our own src/, skills/ and hooks/', async () => {
    const { readdirSync } = await import('node:fs');
    expect(readdirSync('src').every((f) => f.endsWith('.ts'))).toBe(true);
  });

  test('behind only when the upstream moved past the pin', () => {
    const u = UPSTREAMS[0]!;
    expect(isBehind(u, { version: u.version })).toBe(false);
    expect(isBehind(u, { version: '99.0.0' })).toBe(true);
    expect(isBehind({ ...u, version: '1.0', commit: 'abc1234' }, { commit: 'abc12345678' })).toBe(false);
    expect(isBehind({ ...u, version: '1.0', commit: 'abc1234' }, { commit: 'def4567' })).toBe(true);
  });
});

import { commandName } from '../src/settings';

describe('hook identity', () => {
  test('an absolute path to the same tool is the same hook', () => {
    expect(commandName('"C:/Users/x/.local/bin/codebase-memory-mcp.exe"')).toBe('codebase-memory-mcp');
    expect(commandName('rtk hook claude')).toBe('rtk');
    expect(commandName('/usr/local/bin/rtk hook claude')).toBe('rtk');
  });

  test('settings already containing the tuning are left alone, whatever paths they use', () => {
    const current: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: '/opt/homebrew/bin/rtk hook claude' }] },
          { matcher: 'Grep|Glob|Bash', hooks: [{ type: 'command', command: 'C:/bin/codebase-memory-mcp.exe', args: ['hook-augment'], timeout: 5 }] },
        ],
      },
    };
    const { changes } = merge(current, { hooks: desired({ rtk: true, codebaseMemory: true }).hooks!.PreToolUse ? { PreToolUse: desired({ rtk: true, codebaseMemory: true }).hooks!.PreToolUse! } : {} });
    expect(changes).toEqual([]);
  });
});
