import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

  test('always finds the built-in skills, and every entry has a description', () => {
    const roster = loadRoster(process.cwd());
    expect(roster.some((s) => s.id === 'code-review')).toBe(true);
    expect(roster.every((s) => s.description.length > 0)).toBe(true);
  });

  // Needs this machine's own skills and plugins.
  test.skipIf(!existsSync(join(homedir(), '.claude', 'skills')))('reads personal and plugin skills', () => {
    const roster = loadRoster(process.cwd());
    expect(roster.length).toBeGreaterThan(100);
    expect(roster.some((s) => s.id === 'web-search:web-search')).toBe(true);
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

// Needs context-mode installed on this machine; CI has no Claude Code install.
const cmRoot = join(homedir(), '.claude', 'plugins', 'cache', 'context-mode', 'context-mode');
const cmVersions = existsSync(cmRoot) ? readdirSync(cmRoot).sort() : [];

describe.skipIf(!cmVersions.length)('context-mode cap', () => {
  // Read lazily: skipIf still evaluates this describe body.
  const read = () => readFileSync(join(cmRoot, cmVersions.at(-1) ?? '', 'hooks', 'sessionstart.mjs'), 'utf8');

  test('patches the installed context-mode once', () => {
    const once = patch(read().replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'));
    expect(once).toContain(MARK);
    expect(patch(once!)).toBeNull();
  });

  test('the patched cut keeps the start and stays under 10,000 characters', () => {
    let additionalContext = `<rules>${'r'.repeat(4600)}</rules>\n` + 'line of session guide\n'.repeat(1200);
    // Run the exact snippet the patch inserts.
    const snippet = /if \(additionalContext\.length > 9500\) \{[\s\S]*?\n  \}/.exec(patch(read().replace(/\n\s*\/\/ \[claude-tuning[^\n]*[\s\S]*?\n  }\n/, '\n'))!)![0];
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

import { desired, merge, withRules, type Settings } from '../src/settings';
import { UPSTREAMS, plugins } from '../src/upstreams';
import { isBehind } from '../src/check-upstreams';

describe('settings merge', () => {
  const want = desired({ rtk: true, codebaseMemory: false });

  test('keeps existing keys and hooks, adds what is missing', () => {
    const current: Settings = { model: 'opus', env: { FOO: 'bar' }, hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier' }] }] } };
    const { next, changes } = merge(current, want);
    expect(next.model).toBe('opus');
    expect(next.env!.FOO).toBe('bar');
    expect(next.env!.PONYTAIL_SUBAGENT_MATCHER).toBeDefined();
    expect(next.env!.CLAUDE_CODE_SUBAGENT_MODEL).toBeUndefined(); // subagent limits are personal, not ours to set
    expect(next.hooks!.PreToolUse!.length).toBe(2);
    expect(changes.length).toBeGreaterThan(0);
  });

  test('is idempotent: a second merge changes nothing', () => {
    const once = merge({}, want).next;
    expect(merge(once, want).changes).toEqual([]);
  });

  test('rules block: appended once, replaced in place, the rest kept', () => {
    const mine = '# My rules\n- be brief\n';
    const once = withRules(mine, 'v1 rules');
    expect(once.startsWith('# My rules')).toBe(true);
    expect(once).toContain('v1 rules');
    expect(withRules(once, 'v1 rules')).toBe(once);
    const twice = withRules(once + '\n## After\n', 'v2 rules');
    expect(twice).toContain('v2 rules');
    expect(twice).not.toContain('v1 rules');
    expect(twice).toContain('## After');
    expect(twice.match(/claude-tuning:start/g)!.length).toBe(1);
    expect(withRules('', 'x')).toBe('<!-- claude-tuning:start -->\nx\n<!-- claude-tuning:end -->\n');
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
    expect(plugins().map((u) => u.id)).toContain('ponytail');
    expect(UPSTREAMS.some((u) => u.id === 'context7')).toBe(false);
  });

  test('every script the plugin wires (hooks.json, .mcp.json) exists', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const wired = [readFileSync('hooks/hooks.json', 'utf8'), readFileSync('.mcp.json', 'utf8')].join('\n');
    const paths = [...wired.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)].map((m) => m[1]!);
    expect(paths).toContain('src/squeeze/hook.ts');
    expect(paths).toContain('src/stash/server.ts');
    for (const p of paths) expect(existsSync(p)).toBe(true);
  });

  test('optional upstreams say what replaces them', () => {
    const optional = UPSTREAMS.filter((u) => u.optional).map((u) => u.id);
    expect(optional.sort()).toEqual(['context-mode', 'rtk']);
  });

  test('no third-party code is vendored: only our own src/, skills/ and hooks/', async () => {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync('src', { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
    expect(files.filter((e) => !e.name.endsWith('.ts'))).toEqual([]);
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
