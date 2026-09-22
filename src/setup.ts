#!/usr/bin/env bun
/**
 * One command that sets up the whole toolset: `bun run setup --apply` (or `/tune` inside Claude Code).
 * Prints a plan by default and changes nothing until you pass --apply. Works on macOS, Linux and Windows.
 * Installs plugins from their own repos at the pinned versions in src/upstreams.ts, then merges the
 * settings in src/settings.ts into ~/.claude/settings.json (existing values are kept, a .bak is written).
 * Binaries (codebase-memory-mcp) are never installed for you: their commands are printed.
 */
import { plugins, tools, UPSTREAMS } from './upstreams';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { claudeMdPath, desired, merge, readSettings, settingsPath, withRules, writeSettings } from './settings';

const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const wanted = (u: { id: string }) => !ONLY || ONLY.includes(u.id);

const out = (s = '') => process.stdout.write(`${s}\n`);
const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);

export async function has(command: string, args = ['--version']): Promise<boolean> {
  try {
    const p = Bun.spawn([command, ...args], { stdout: 'ignore', stderr: 'ignore' });
    return (await p.exited) === 0;
  } catch {
    return false;
  }
}

async function run(cmd: string[]): Promise<{ ok: boolean; output: string }> {
  const p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { ok: (await p.exited) === 0, output: `${stdout}${stderr}`.trim() };
}

/** Plugin ids Claude Code already has installed. */
export async function installed(): Promise<Set<string>> {
  const { ok, output } = await run(['claude', 'plugin', 'list', '--json']);
  if (!ok) return new Set();
  try {
    const parsed = JSON.parse(output) as unknown;
    const rows = (Array.isArray(parsed) ? parsed : ((parsed as { plugins?: unknown[] }).plugins ?? [])) as { id?: string }[];
    return new Set(rows.map((r) => r.id ?? '').filter(Boolean));
  } catch {
    return new Set();
  }
}

async function main() {
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  out(bold('claude-tuning setup'));
  out(APPLY ? 'Applying changes.\n' : 'Plan only. Re-run with --apply to make these changes.\n');

  // 1. Prerequisites.
  const bunOk = true; // this script is running under Bun
  const claudeOk = await has('claude');
  out(bold('Prerequisites'));
  out(`  bun      ${bunOk ? 'ok' : 'missing'}`);
  out(`  claude   ${claudeOk ? 'ok' : 'missing — install Claude Code first: https://claude.com/claude-code'}`);
  if (!claudeOk) process.exit(1);

  // 2. Plugins, each from its own repo at the pinned version.
  const already = await installed();
  out(`\n${bold('Plugins')}`);
  for (const u of plugins()) {
    if (!wanted(u)) continue;
    const id = `${u.plugin}@${u.marketplace}`;
    if (already.has(id)) {
      out(`  ${u.id.padEnd(16)} already installed`);
      continue;
    }
    if (!APPLY) {
      out(`  ${u.id.padEnd(16)} would install ${id} (${u.repo}, pinned ${u.version}, ${u.license})`);
      continue;
    }
    const add = await run(['claude', 'plugin', 'marketplace', 'add', u.repo]);
    const install = await run(['claude', 'plugin', 'install', id]);
    out(`  ${u.id.padEnd(16)} ${install.ok ? 'installed' : `failed: ${(install.output || add.output).split('\n').pop()}`}`);
  }

  // 3. Binaries we never install for you.
  out(`\n${bold('Command-line tools')} (install these yourself; claude-tuning only reports them)`);
  for (const u of tools()) {
    if (!wanted(u)) continue;
    const present = await has('codebase-memory-mcp');
    out(`  ${u.id.padEnd(16)} ${present ? 'ok' : `missing — ${u.install?.[platform] ?? u.repo}`}`);
  }

  // 4. Settings, merged.
  const present = { codebaseMemory: await has('codebase-memory-mcp') };
  const current = readSettings();
  const { next, changes } = merge(current, desired(present));
  out(`\n${bold('Settings')} (${settingsPath()})`);
  if (!changes.length) out('  already as recommended');
  else changes.forEach((c) => out(`  ${APPLY ? 'set' : 'would set'} ${c}`));
  if (APPLY && changes.length) {
    writeSettings(next);
    out(`  written (previous file kept as settings.json.bak)`);
  }

  // 5. Tool rules in CLAUDE.md, between markers so later runs replace only our block.
  const mdPath = claudeMdPath();
  const md = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : '';
  const mdNext = withRules(md, readFileSync(`${import.meta.dir}/../rules.md`, 'utf8'));
  out(`\n${bold('CLAUDE.md')} (${mdPath})`);
  if (process.argv.includes('--no-rules')) out('  skipped (--no-rules)');
  else if (mdNext === md) out('  tool rules already current');
  else if (!APPLY) out('  would add the tool rules block (web-search, squeeze, stash, ponytail, code graph)');
  else {
    if (md) copyFileSync(mdPath, `${mdPath}.bak`);
    writeFileSync(mdPath, mdNext);
    out('  tool rules block written (previous file kept as CLAUDE.md.bak)');
  }

  // 6. Keys, presence only.
  out(`\n${bold('API keys')}`);
  out(`  JINA_API_KEY      ${process.env.JINA_API_KEY ? 'set' : 'not set — web search needs it (free: https://jina.ai/?sui=apikey)'}`);
  out(`  TYPESAFE_API_KEY  ${process.env.TYPESAFE_API_KEY ? 'set' : 'not set — optional; enables Jev skill suggestions, model routing and source picking'}`);

  out(`\n${UPSTREAMS.length} upstreams pinned; see UPSTREAMS.md. Restart Claude Code when this finishes.`);
  if (!APPLY) out('Nothing was changed. Run: bun run setup --apply');
}

if (import.meta.main) await main();
