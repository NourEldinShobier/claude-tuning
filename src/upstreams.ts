/**
 * Every third-party piece this setup installs, pinned to the version we tested with.
 * Nothing here is vendored: each tool is fetched from its own source, so its licence and
 * updates stay with its author. `bun run upstreams` reports newer releases (src/check-upstreams.ts).
 */

export type Platform = 'darwin' | 'linux' | 'win32';

export interface Upstream {
  /** Short id used in reports and flags. */
  id: string;
  repo: string;
  /** SPDX id, or 'none' when the project declares no licence (then we can only install, never copy). */
  license: string;
  kind: 'plugin' | 'cli' | 'mcp' | 'skill';
  /** Claude Code marketplace and plugin id, for `kind: 'plugin'`. */
  marketplace?: string;
  plugin?: string;
  /** Version and commit this setup was tested against. */
  version: string;
  commit?: string;
  /** Why it is in the set. */
  why: string;
  /** What claude-tuning changes about it, if anything. */
  ours?: string;
  /** The tool's official install command per platform, for `kind: 'cli' | 'mcp'`; setup runs it when the tool is missing. A platform left out is not supported. */
  install?: Partial<Record<Platform, string>>;
  /** Plugin options passed to `claude plugin install --config KEY=VALUE`. */
  config?: Record<string, string>;
  /** Executable name; setup treats the tool as installed when it runs. */
  bin?: string;
  /** For `kind: 'skill'`: folder under the home directory; installed when its SKILL.md exists. */
  path?: string;
}

const TOOLGATE = '11aa21e4e3381b7f8aa8d4b4d442380e989ab52c';
/** npm 12 refuses git packages unless asked; the fork ships dist/, so no install scripts are needed. */
const toolgateNpm = `npm install -g --allow-git=all github:NourEldinShobier/toolgate#${TOOLGATE}`;
const JEV_SEO = '55a184a3b0d09565a4c84268f725a47784e62528';

export const UPSTREAMS: Upstream[] = [
  {
    id: 'stash',
    repo: 'NourEldinShobier/stash',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'stash',
    plugin: 'stash',
    version: '0.2.0',
    commit: 'd13617983afbbc7876f5f08f90fb3507bb60f651',
    why: 'MCP server that keeps big outputs, files and pages in a local search index and returns only what Claude asks for, ranked by Jev.',
    ours: 'Ours. Separate repo so it can be installed alone.',
  },
  {
    id: 'ponytail',
    repo: 'DietrichGebert/ponytail',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'ponytail',
    plugin: 'ponytail',
    version: '5.3.2',
    commit: '16352ac229eb08a9598dcae48fe9f2b342567d86',
    why: 'Pushes the agent to the simplest solution that works, and to reuse what the repo already has.',
  },
  {
    id: 'i-have-adhd',
    repo: 'ayghri/i-have-adhd',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'i-have-adhd',
    plugin: 'i-have-adhd',
    version: '0.4.1',
    commit: '1ecea1993b7fce257ffbd686c070948b5e07eda6',
    why: 'Answers lead with the next action, numbered steps, no preamble. Shorter output is also cheaper output.',
  },
  {
    id: 'fast-jev-compaction',
    repo: 'tamaratran/fast-jev-compaction',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'fast-jev-compaction',
    plugin: 'fast-jev-compaction',
    version: '0.3.0',
    commit: 'e3f262a7f4d42bd8dd32ced30d26176f7cb545b0',
    why: "Replaces Claude Code's summarising compaction: Jev picks which messages to keep, and kept messages stay word for word. Needs Claude Code 2.1.274+ and TYPESAFE_API_KEY; without them the built-in compaction runs.",
    ours: 'Setup turns on function hooks (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1), which it needs.',
  },
  {
    id: 'quicksilver',
    repo: 'UditAkhourii/quicksilver',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'quicksilver',
    plugin: 'quicksilver',
    version: '0.1.0',
    commit: '5d6fe5cd4f9d9a9d086a81c797e59b77c0724043',
    why: 'Skill that hands bulk judgment calls (which files matter, which log lines are failures, labels for many items, ranking) to Jev, so Claude reads only the shortlist. 86% fewer Claude tokens on its 12-task benchmark. Needs Node 18+ and TYPESAFE_API_KEY.',
    ours: 'The tool rules tell Claude when to reach for it.',
  },
  {
    id: 'compact-adviser',
    repo: 'kunchenguid/compact-adviser',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'compact-adviser',
    plugin: 'compact-adviser',
    version: '0.1.13',
    commit: '7dc0693ea7f209067453f2874d02afc2fe83b128',
    why: 'Jev judges when a finished piece of work makes a safe point to /compact, and compacts there instead of mid-task. Needs Claude Code 2.1.274+, Node 22+ and TYPESAFE_API_KEY.',
    ours: 'Setup installs it in auto mode; run /compact-adviser auto once to confirm. Uses the function hooks setup already turns on.',
    config: { mode: 'auto' },
  },
  {
    id: 'jev-steer-or-queue',
    repo: 'NourEldinShobier/Jev_steer_or_queue',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'jev-steer-or-queue',
    plugin: 'jev-steer-or-queue',
    version: '0.3.0',
    commit: '3a364c13f83dc5a22f426000181ce918a1e3bde9',
    why: 'Jev decides whether a message sent mid-turn steers the running task, waits in a queue until the turn ends, or stops it. Needs TYPESAFE_API_KEY.',
    ours: 'Our fork of Larkspur-Wang/Jev_steer_or_queue (see its UPSTREAM.lock.json): a Rust router (~90 ms per hook, works on Windows; upstream crashed there) with the Python one as fallback. Installed in shadow mode (logs decisions only); set its mode to active in /plugin to queue and stop for real.',
  },
  {
    id: 'rtk',
    repo: 'rtk-ai/rtk',
    license: 'Apache-2.0',
    kind: 'cli',
    version: '1.0.1',
    commit: '4ef8730cf3a0dea11c8d64a9b90bc0616fe52100',
    why: 'Compresses shell output (git, tests, builds, docker, kubectl, package managers and more) before it reaches the model. Up to 90% less output.',
    ours: 'Setup installs rtk-oss, the Apache-2.0 edition (hooks and every command filter; the full edition adds a BUSL-1.1 compression engine), with its official installer, and adds its Claude Code hook (rtk hook claude) for Bash and PowerShell.',
    install: {
      darwin: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | RTK_EDITION=oss sh',
      linux: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | RTK_EDITION=oss sh',
      win32: "$d = Join-Path $env:USERPROFILE '.local\\bin'; New-Item -ItemType Directory -Force $d | Out-Null; $z = Join-Path $env:TEMP 'rtk.zip'; $x = Join-Path $env:TEMP 'rtk-oss'; irm https://github.com/rtk-ai/rtk/releases/download/v1.0.1/rtk-oss-x86_64-pc-windows-msvc.zip -OutFile $z; Expand-Archive $z -DestinationPath $x -Force; Copy-Item (Join-Path $x 'rtk.exe') $d -Force",
    },
    bin: 'rtk',
  },
  {
    id: 'codebase-memory',
    repo: 'DeusData/codebase-memory-mcp',
    license: 'MIT',
    kind: 'mcp',
    version: '0.12.1',
    commit: 'a7158ac2f48ca646b4527341b76f930f2aeff87e',
    why: 'Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context.',
    ours: 'The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search.',
    install: {
      darwin: 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash',
      linux: 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash',
      win32: "$f = Join-Path $env:TEMP 'cbm-install.ps1'; irm https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile $f; Unblock-File $f; & $f",
    },
    bin: 'codebase-memory-mcp',
  },
  {
    id: 'deepseek-search',
    repo: 'NourEldinShobier/deepseek-search',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'deepseek-search',
    plugin: 'deepseek-search',
    version: '0.1.0',
    commit: 'f722e976b1f55ec0ce77a072c3cfbb540ebe74dc',
    why: "Web search and page reading through DeepSeek's Search and Fetch APIs ($0.75 per 1,000 calls): ranked results with summaries, parallel multi-query search, paged Markdown pages. A hook sends WebSearch/WebFetch to it and lets the built-in tools run when DeepSeek has no key or fails. Needs DEEPSEEK_API_KEY.",
    ours: 'Ours. Separate repo so it can be installed alone.',
  },
  {
    id: 'toolgate',
    repo: 'NourEldinShobier/toolgate',
    license: 'MIT',
    kind: 'cli',
    version: '0.17.1',
    commit: TOOLGATE,
    why: "Jev checks each tool call before it runs. Configured here to stop only prompt injection: calls that follow instructions from a web page, file or tool output instead of the user's task. Needs TYPESAFE_API_KEY.",
    ours: 'Our fork of RiskAverseTech/toolgate (see its UPSTREAM.lock.json): built-in risk questions can be turned off, dist/ is committed so it installs from GitHub, and the doctor works on Windows. Setup installs the injection-only policy (when ~/.toolgate/toolgate.yaml is missing) and its Claude Code hooks.',
    install: {
      darwin: `${toolgateNpm} && mkdir -p ~/.toolgate && { [ -f ~/.toolgate/toolgate.yaml ] || cp "$(npm root -g)/@riskaverse/toolgate/examples/injection-only.yaml" ~/.toolgate/toolgate.yaml; } && toolgate install`,
      linux: `${toolgateNpm} && mkdir -p ~/.toolgate && { [ -f ~/.toolgate/toolgate.yaml ] || cp "$(npm root -g)/@riskaverse/toolgate/examples/injection-only.yaml" ~/.toolgate/toolgate.yaml; } && toolgate install`,
      win32: `${toolgateNpm}; if ($?) { $d = Join-Path $env:USERPROFILE '.toolgate'; New-Item -ItemType Directory -Force $d | Out-Null; $p = Join-Path $d 'toolgate.yaml'; if (-not (Test-Path $p)) { Copy-Item (Join-Path (npm root -g) '@riskaverse/toolgate/examples/injection-only.yaml') $p }; toolgate install }`,
    },
    bin: 'toolgate',
  },
  {
    id: 'jev-seo',
    repo: 'AgriciDaniel/jev-seo',
    license: 'MIT',
    kind: 'skill',
    version: '0.1.1',
    commit: JEV_SEO,
    why: 'Skill: live SEO audit of a site from its homepage URL, judged by Jev, with PDF, XLSX and Markdown reports (/jev-seo <url>). Needs Python 3.10+, TYPESAFE_API_KEY, and the Pango library for PDFs (see its README; on Windows, MSYS2 pango plus WEASYPRINT_DLL_DIRECTORIES).',
    ours: 'Setup clones it into ~/.claude/skills/jev-seo at the pinned commit and installs its Python requirements for the current user.',
    install: {
      darwin: `d=~/.claude/skills/jev-seo; git clone -q https://github.com/AgriciDaniel/jev-seo "$d" && git -C "$d" checkout -q ${JEV_SEO} && python3 -m pip install -q --user -r "$d/requirements.txt"`,
      linux: `d=~/.claude/skills/jev-seo; git clone -q https://github.com/AgriciDaniel/jev-seo "$d" && git -C "$d" checkout -q ${JEV_SEO} && python3 -m pip install -q --user -r "$d/requirements.txt"`,
      win32: `$d = Join-Path $env:USERPROFILE '.claude/skills/jev-seo'; git clone -q https://github.com/AgriciDaniel/jev-seo $d; if ($?) { git -C $d checkout -q ${JEV_SEO}; python -m pip install -q --user -r (Join-Path $d 'requirements.txt') }`,
    },
    path: '.claude/skills/jev-seo',
  },
];

export const byId = (id: string) => UPSTREAMS.find((u) => u.id === id);
export const plugins = () => UPSTREAMS.filter((u) => u.kind === 'plugin');
export const tools = () => UPSTREAMS.filter((u) => u.kind !== 'plugin');
