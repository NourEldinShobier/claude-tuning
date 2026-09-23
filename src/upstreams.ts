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
  kind: 'plugin' | 'cli' | 'mcp';
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
  /** How setup tells the tool is installed: an executable name, or a file under the home folder. Without either, an MCP server registered under `id`. */
  bin?: string;
  path?: string;
  /** Oldest Node.js major version the tool runs on. */
  node?: number;
}

export const UPSTREAMS: Upstream[] = [
  {
    id: 'stash',
    repo: 'NourEldinShobier/stash',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'stash',
    plugin: 'stash',
    version: '0.2.0',
    commit: 'd13617983afb',
    why: 'MCP server that keeps big outputs, files and pages in a local search index and returns only what Claude asks for, ranked by Jev.',
    ours: 'Ours. Separate repo so it can be installed alone.',
  },
  {
    id: 'web-search',
    repo: 'NourEldinShobier/web-search',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'web-search',
    plugin: 'web-search',
    version: '0.6.3',
    commit: '299062a5466b',
    why: 'Web, news, paper and image search plus page/PDF reading, trimmed for agents. Replaces WebSearch/WebFetch.',
    ours: 'Ours. Separate repo so it is useful without this bundle.',
  },
  {
    id: 'ponytail',
    repo: 'DietrichGebert/ponytail',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'ponytail',
    plugin: 'ponytail',
    version: '4.10.0',
    commit: 'e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156',
    why: 'Pushes the agent to the simplest solution that works, and to reuse what the repo already has.',
    ours: 'Its per-subagent rules are turned off for the web-search researcher (PONYTAIL_SUBAGENT_MATCHER), which saves about 1.4k tokens per research agent.',
  },
  {
    id: 'i-have-adhd',
    repo: 'ayghri/i-have-adhd',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'i-have-adhd',
    plugin: 'i-have-adhd',
    version: '0.3.0',
    commit: '6f1f982d0a47',
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
    commit: 'e3f262a7f4d4',
    why: "Replaces Claude Code's summarising compaction: Jev picks which messages to keep, and kept messages stay word for word. Needs Claude Code 2.1.274+ and TYPESAFE_API_KEY; without them the built-in compaction runs.",
    ours: 'Setup turns on function hooks (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1), which it needs.',
  },
  {
    id: 'rtk',
    repo: 'rtk-ai/rtk',
    license: 'Apache-2.0',
    kind: 'cli',
    version: '0.49.0',
    why: 'Compresses shell output (git, tests, builds, docker, kubectl, package managers and more) before it reaches the model. Up to 90% less output.',
    ours: 'Setup installs it with its official installer and adds its Claude Code hook (rtk hook claude) for Bash and PowerShell.',
    install: {
      darwin: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      linux: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      win32: "$d = Join-Path $env:USERPROFILE '.local\\bin'; New-Item -ItemType Directory -Force $d | Out-Null; $z = Join-Path $env:TEMP 'rtk.zip'; irm https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-pc-windows-msvc.zip -OutFile $z; Expand-Archive $z -DestinationPath $d -Force",
    },
    bin: 'rtk',
  },
  {
    id: 'codebase-memory',
    repo: 'DeusData/codebase-memory-mcp',
    license: 'MIT',
    kind: 'mcp',
    version: '0.11.0',
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
    id: 'jev-browser',
    repo: 'jkudish/jev-browser',
    license: 'MIT',
    kind: 'mcp',
    version: '0.4.1',
    commit: 'f2b13a05890c',
    why: 'Multi-step browser tasks in headless Chromium, with Jev choosing each action: a few cents of Jev instead of Claude reading every page. Needs TYPESAFE_API_KEY.',
    ours: 'Setup registers its MCP server for all projects (user scope).',
    install: {
      darwin: 'claude mcp add -s user jev-browser -- npx -y @jkudish/jev-browser@0.4.1',
      linux: 'claude mcp add -s user jev-browser -- npx -y @jkudish/jev-browser@0.4.1',
      // Claude Code on Windows can only start npx through cmd.
      win32: 'claude mcp add -s user jev-browser -- cmd /c npx -y @jkudish/jev-browser@0.4.1',
    },
    node: 22,
  },
  {
    id: 'canny',
    repo: 'qkal/canny',
    license: 'MIT',
    kind: 'cli',
    version: '0.3.0',
    commit: 'f2c5e5377944',
    why: 'Hooks that block "done" until a real check (tests, typecheck, lint) has passed since the last edit, so Claude does not stop on unverified work.',
    ours: 'Setup follows its install: clone to ~/.canny/src, then `init --global --claude` writes its hooks into ~/.claude/settings.json.',
    install: {
      darwin: 'git clone -q https://github.com/qkal/canny.git ~/.canny/src && node ~/.canny/src/dist/cli.js init --global --claude',
      linux: 'git clone -q https://github.com/qkal/canny.git ~/.canny/src && node ~/.canny/src/dist/cli.js init --global --claude',
      win32: "$d = Join-Path $HOME '.canny\\src'; git clone -q https://github.com/qkal/canny.git $d; if ($LASTEXITCODE -eq 0) { node (Join-Path $d 'dist\\cli.js') init --global --claude }",
    },
    path: '.canny/src/dist/cli.js',
    node: 22,
  },
  {
    id: 'agent-desktop',
    repo: 'lahfir/agent-desktop',
    license: 'Apache-2.0',
    kind: 'cli',
    version: '0.9.4',
    commit: 'a4a695fdd1f6',
    why: 'Drives native macOS apps through the accessibility tree: compact element refs instead of screenshots. macOS only.',
    ours: 'Setup installs the CLI from npm and its agent-desktop and jev-desktop skills into ~/.claude/skills.',
    install: {
      darwin:
        'npm install -g agent-desktop@0.9.4 && d=$(mktemp -d) && git clone -q --depth 1 --branch v0.9.4 https://github.com/lahfir/agent-desktop "$d" && mkdir -p ~/.claude/skills && cp -R "$d/skills/agent-desktop" "$d/skills/jev-desktop" ~/.claude/skills/ && rm -rf "$d"',
    },
    bin: 'agent-desktop',
  },
];

export const byId = (id: string) => UPSTREAMS.find((u) => u.id === id);
export const plugins = () => UPSTREAMS.filter((u) => u.kind === 'plugin');
export const tools = () => UPSTREAMS.filter((u) => u.kind !== 'plugin');
