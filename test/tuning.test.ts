import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadRoster, parseSkill } from '../src/roster';
import { block, skip } from '../src/suggest';

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
  const want = desired({ codebaseMemory: false });

  test('keeps existing keys and hooks, adds what is missing', () => {
    const current: Settings = { model: 'opus', env: { FOO: 'bar' }, hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier' }] }] } };
    const { next, changes } = merge(current, want);
    expect(next.model).toBe('opus');
    expect(next.env!.FOO).toBe('bar');
    expect(next.env!.PONYTAIL_SUBAGENT_MATCHER).toBeDefined();
    expect(next.env!.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS).toBe('1'); // fast-jev-compaction needs it
    expect(next.env!.CLAUDE_CODE_SUBAGENT_MODEL).toBeUndefined(); // subagent limits are personal, not ours to set
    expect(next.hooks!.PreToolUse).toEqual(current.hooks!.PreToolUse);
    expect(changes.length).toBeGreaterThan(0);
  });

  test('removes Canny hooks left by 0.11.0 and keeps the others', () => {
    const canny = { hooks: [{ type: 'command', command: 'node "C:\\Users\\x\\.canny\\src\\dist\\cli.js" hook --agent claude' }] };
    const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook claude' }] };
    const { next } = merge({ hooks: { Stop: [canny], PreToolUse: [other, canny] } }, {});
    expect(next.hooks).toEqual({ PreToolUse: [other] });
    expect(UPSTREAMS.map((u) => u.id)).not.toContain('canny');
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

  test('turns on auto-update for our marketplaces, keeping any existing source', () => {
    const current: Settings = {
      extraKnownMarketplaces: {
        stash: { source: { source: 'directory', path: 'D:/dev/stash' } },
        ponytail: { source: { source: 'github', repo: 'DietrichGebert/ponytail' } },
      },
    };
    const { next } = merge(current, want);
    const m = next.extraKnownMarketplaces as Record<string, { source: { source: string; path?: string; repo?: string }; autoUpdate?: boolean }>;
    for (const name of ['claude-tuning', 'stash', 'web-search']) expect(m[name]!.autoUpdate).toBe(true);
    expect(m.stash!.source).toEqual({ source: 'directory', path: 'D:/dev/stash' });
    expect(m['web-search']!.source).toEqual({ source: 'github', repo: 'NourEldinShobier/web-search' });
    expect(m.squeeze).toBeUndefined();
    expect(m.ponytail!.autoUpdate).toBeUndefined(); // third-party stays pinned
    expect(merge(next, want).changes).toEqual([]);
  });

  test('hooks for a tool that is not installed are not written', () => {
    expect(Object.keys(desired({ codebaseMemory: false }).hooks ?? {})).toEqual([]);
  });
});

describe('upstreams', () => {
  test('every entry is installable: licence, version and a plugin id or install commands', () => {
    for (const u of UPSTREAMS) {
      expect(u.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(u.license.length).toBeGreaterThan(0);
      expect(u.version).toMatch(/^\d+\.\d+/);
      if (u.kind === 'plugin') expect(`${u.plugin}@${u.marketplace}`).not.toContain('undefined');
      else expect(Object.keys(u.install ?? {}).length).toBeGreaterThan(0);
    }
    expect(plugins().map((u) => u.id)).toContain('ponytail');
    expect(UPSTREAMS.some((u) => u.id === 'context7')).toBe(false);
  });

  test('every script hooks.json wires exists', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const paths = [...readFileSync('hooks/hooks.json', 'utf8').matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)].map((m) => m[1]!);
    expect(paths).toEqual(['src/suggest.ts', 'src/route-model.ts']);
    for (const p of paths) expect(existsSync(p)).toBe(true);
  });

  test('rtk compresses shell output; stash is installed from its own repo; squeeze and context-mode are gone', () => {
    const ids = UPSTREAMS.map((u) => u.id);
    expect(ids).toContain('rtk');
    expect(ids).toContain('stash');
    expect(ids).not.toContain('squeeze');
    expect(ids).not.toContain('context-mode');
  });

  test('the rtk hook is added only when rtk is installed, by the path setup found', () => {
    expect(desired({ codebaseMemory: false }).hooks?.PreToolUse).toBeUndefined();
    const pre = desired({ codebaseMemory: false, rtk: 'C:/Users/x/.local/bin/rtk.exe' }).hooks!.PreToolUse!;
    expect(pre[0]).toEqual({ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'C:/Users/x/.local/bin/rtk.exe hook claude' }] });
    // An existing bare `rtk hook claude` counts as the same hook.
    expect(merge({ hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'rtk hook claude' }] }] } }, { hooks: { PreToolUse: pre } }).changes).toEqual([]);
  });

  test('the marketplace lists every plugin of ours that setup installs', async () => {
    const { readFileSync } = await import('node:fs');
    const listed = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8')).plugins.map((p: { name: string }) => p.name);
    for (const id of ['stash', 'web-search']) expect(listed).toContain(id);
    expect(listed).not.toContain('squeeze');
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

import { binPaths, hasBin, isInstalled, shellFor, versionOf } from '../src/setup';
import { tools } from '../src/upstreams';

describe('tool install', () => {
  test('every tool can be detected and installs on every platform', () => {
    for (const u of tools()) {
      expect(u.bin).toBeTruthy();
      const platforms = Object.keys(u.install ?? {});
      expect(platforms).toEqual(['darwin', 'linux', 'win32']);
      // A Windows installer that downloads a file puts it in %TEMP%, never in the folder setup runs in.
      if (u.install!.win32?.includes('-OutFile')) expect(u.install!.win32).toContain('$env:TEMP');
      expect(u.install!.win32 ?? '').not.toContain('.\\install.ps1');
    }
  });

  test('a tool counts as installed only when its binary runs', async () => {
    expect(await isInstalled({ id: 'x', repo: 'a/b', license: 'MIT', kind: 'cli', version: '1.0', why: '', bin: 'no-such-tool-claude-tuning' })).toBe(false);
  });

  test('version parsing reads X.Y.Z; a missing command is [0]', async () => {
    expect((await versionOf(['bun', '--version'])).length).toBe(3);
    expect(await versionOf(['no-such-tool-claude-tuning'])).toEqual([0]);
  });

  test('installers run through the platform shell', () => {
    expect(shellFor('x', 'win32').slice(0, 1)).toEqual(['powershell']);
    expect(shellFor('x', 'win32')).toContain('Bypass');
    expect(shellFor('x', 'darwin')).toEqual(['bash', '-c', 'x']);
    expect(shellFor('x', 'linux')).toEqual(['bash', '-c', 'x']);
  });

  test('installer locations cover both Windows install folders', () => {
    const win = binPaths('codebase-memory-mcp', 'win32');
    expect(win.some((p) => p.includes('Programs') && p.endsWith('codebase-memory-mcp.exe'))).toBe(true);
    expect(win.some((p) => p.includes('.local'))).toBe(true);
    expect(binPaths('codebase-memory-mcp', 'darwin')[0]).toMatch(/\.local[\\/]bin[\\/]codebase-memory-mcp$/);
  });

  test('a missing binary is reported missing', async () => {
    expect(await hasBin('no-such-tool-claude-tuning')).toBe(false);
    expect(await hasBin('bun')).toBe(true);
  });
});

import { commandName } from '../src/settings';

describe('hook identity', () => {
  test('an absolute path to the same tool is the same hook', () => {
    expect(commandName('"C:/Users/x/.local/bin/codebase-memory-mcp.exe"')).toBe('codebase-memory-mcp');
    expect(commandName('codebase-memory-mcp hook-augment')).toBe('codebase-memory-mcp');
    expect(commandName('/usr/local/bin/codebase-memory-mcp hook-augment')).toBe('codebase-memory-mcp');
  });

  test('settings already containing the tuning are left alone, whatever paths they use', () => {
    const current: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Grep|Glob|Bash', hooks: [{ type: 'command', command: 'C:/bin/codebase-memory-mcp.exe', args: ['hook-augment'], timeout: 5 }] },
        ],
      },
    };
    const { changes } = merge(current, { hooks: { PreToolUse: desired({ codebaseMemory: true }).hooks!.PreToolUse! } });
    expect(changes).toEqual([]);
  });
});
