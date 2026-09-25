#!/usr/bin/env bun
/**
 * One command that sets up the whole toolset: `bun run setup --apply` (or `/tune` inside Claude Code).
 * Prints a plan by default and changes nothing until you pass --apply. Works on macOS, Linux and Windows.
 * Installs plugins from their own repos at the pinned versions in src/upstreams.ts, then merges the
 * settings in src/settings.ts into ~/.claude/settings.json (existing values are kept, a .bak is written).
 * Missing tools (codebase-memory-mcp) are installed with their project's own official installer.
 */
import { plugins, tools, UPSTREAMS, type Platform, type Upstream } from './upstreams';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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

/** Where installers put a tool, for the moment before a new shell sees their PATH change. */
export function binPaths(bin: string, platform: string = process.platform): string[] {
  if (platform !== 'win32') return [join(homedir(), '.local', 'bin', bin)];
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  return [join(localAppData, 'Programs', bin, `${bin}.exe`), join(homedir(), '.local', 'bin', `${bin}.exe`)];
}

/** The command to call a tool by: its bare name when on PATH, else its full path in an installer location. */
export async function binPath(bin: string): Promise<string | undefined> {
  if (await has(bin)) return bin;
  for (const p of binPaths(bin)) if (existsSync(p) && (await has(p))) return p.replace(/\\/g, '/');
  return undefined;
}

/** Installed when on PATH or in one of the installer locations. */
export async function hasBin(bin: string): Promise<boolean> {
  if (await has(bin)) return true;
  for (const p of binPaths(bin)) if (existsSync(p) && (await has(p))) return true;
  return false;
}

/** Claude Code's config file, where `claude mcp add -s user` registers servers. */
const claudeJson = () => (process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : join(homedir(), '.claude.json'));

/** Installed: its executable runs, its file exists, or (MCP servers with neither) it is registered in Claude Code. */
export async function isInstalled(u: Upstream): Promise<boolean> {
  if (u.bin) return hasBin(u.bin);
  if (u.path) return existsSync(join(homedir(), u.path));
  try {
    return Boolean(JSON.parse(readFileSync(claudeJson(), 'utf8')).mcpServers?.[u.id]);
  } catch {
    return false;
  }
}

/** [major, minor, patch] of the first X.Y.Z a command prints; [0] when the command is missing. */
export async function versionOf(cmd: string[]): Promise<number[]> {
  const { ok, output } = await run(cmd);
  return ok ? (output.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0]) : [0];
}

/** The shell that runs an install command on this platform. */
export const shellFor = (command: string, platform: string = process.platform): string[] =>
  platform === 'win32' ? ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command] : ['bash', '-c', command];

/**
 * Runs an official installer. On Windows, PSModulePath is dropped: when setup is started from PowerShell 7
 * it points Windows PowerShell 5.1 at 7's modules, and built-ins like Get-FileHash then fail to load.
 */
export async function runInstaller(command: string): Promise<{ ok: boolean; output: string }> {
  const env = { ...process.env };
  if (process.platform === 'win32') delete env.PSModulePath;
  const p = Bun.spawn(shellFor(command), { stdout: 'pipe', stderr: 'pipe', env });
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { ok: (await p.exited) === 0, output: `${stdout}${stderr}`.trim() };
}

async function run(cmd: string[]): Promise<{ ok: boolean; output: string }> {
  let p;
  try {
    p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  } catch {
    return { ok: false, output: `${cmd[0]} not found` };
  }
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
  const platform = process.platform as Platform;
  out(bold('claude-tuning setup'));
  out(APPLY ? 'Applying changes.\n' : 'Plan only. Re-run with --apply to make these changes.\n');

  // 1. Prerequisites.
  const bunOk = true; // this script is running under Bun
  const claudeOk = await has('claude');
  out(bold('Prerequisites'));
  out(`  bun      ${bunOk ? 'ok' : 'missing'}`);
  out(`  claude   ${claudeOk ? 'ok' : 'missing — install Claude Code first: https://claude.com/claude-code'}`);
  if (!claudeOk) process.exit(1);
  const [cMaj = 0, cMin = 0, cPatch = 0] = await versionOf(['claude', '--version']);
  if (cMaj * 1e6 + cMin * 1e3 + cPatch < 2_001_274) out('  note     fast-jev-compaction needs Claude Code 2.1.274 or newer; run `claude update`. Until then the built-in compaction runs.');
  const [nodeMajor = 0] = await versionOf(['node', '--version']);
  out(`  node     ${nodeMajor ? `${nodeMajor} ok` : 'missing — jev-browser needs Node 22+ (https://nodejs.org)'}`);

  // 2. Plugins, each from its own repo at the pinned version.
  const already = await installed();
  out(`\n${bold('Plugins')}`);
  for (const u of plugins()) {
    if (!wanted(u)) continue;
    const id = `${u.plugin}@${u.marketplace}`;
    if (already.has(id)) {
      out(`  ${u.id.padEnd(20)} already installed`);
      continue;
    }
    if (!APPLY) {
      out(`  ${u.id.padEnd(20)} would install ${id} (${u.repo}, pinned ${u.version}, ${u.license})`);
      continue;
    }
    const add = await run(['claude', 'plugin', 'marketplace', 'add', u.repo]);
    const install = await run(['claude', 'plugin', 'install', id]);
    out(`  ${u.id.padEnd(20)} ${install.ok ? 'installed' : `failed: ${(install.output || add.output).split('\n').pop()}`}`);
  }

  // 3. Tools, installed with their own official installer when missing.
  out(`\n${bold('Tools')}`);
  for (const u of tools()) {
    if (!wanted(u)) continue;
    const cmd = u.install?.[platform];
    if (!cmd) {
      out(`  ${u.id.padEnd(20)} skipped: not available on ${platform}`);
      continue;
    }
    if (await isInstalled(u)) {
      out(`  ${u.id.padEnd(20)} already installed`);
      continue;
    }
    if (u.node && nodeMajor < u.node) {
      out(`  ${u.id.padEnd(20)} skipped: needs Node ${u.node}+${nodeMajor ? `, found ${nodeMajor}` : ''}`);
      continue;
    }
    if (!APPLY) {
      out(`  ${u.id.padEnd(20)} would install with its official installer (${u.repo})`);
      continue;
    }
    const r = await runInstaller(cmd);
    const ok = await isInstalled(u);
    out(`  ${u.id.padEnd(20)} ${ok ? 'installed' : `install failed: ${r.output.split('\n').filter(Boolean).pop() ?? 'no output'}`}`);
  }

  // 4. Settings, merged.
  const present = { codebaseMemory: await hasBin('codebase-memory-mcp'), rtk: await binPath('rtk') };
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
  else if (!APPLY) out('  would add the tool rules block');
  else {
    if (md) copyFileSync(mdPath, `${mdPath}.bak`);
    writeFileSync(mdPath, mdNext);
    out('  tool rules block written (previous file kept as CLAUDE.md.bak)');
  }

  // 6. Keys, presence only.
  out(`\n${bold('API keys')}`);
  out(`  JINA_API_KEY      ${process.env.JINA_API_KEY ? 'set' : 'not set — web search needs it (free: https://jina.ai/?sui=apikey)'}`);
  out(`  TYPESAFE_API_KEY  ${process.env.TYPESAFE_API_KEY ? 'set' : 'not set — optional; turns on the Jev parts: skill suggestions, model routing, compaction, jev-browser, ranking'}`);

  out(`\n${UPSTREAMS.length} upstreams pinned; see UPSTREAMS.md. Restart Claude Code when this finishes.`);
  if (!APPLY) out('Nothing was changed. Run: bun run setup --apply');
}

if (import.meta.main) await main();
