/**
 * Every third-party piece this setup installs, pinned to the version we tested with.
 * Nothing here is vendored: each tool is fetched from its own source, so its licence and
 * updates stay with its author. `bun run upstreams` reports newer releases (src/check-upstreams.ts).
 */

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
  /** The tool's official install command per platform, for `kind: 'cli' | 'mcp'`; setup runs it when the tool is missing. */
  install?: { darwin: string; linux: string; win32: string };
  /** Executable name, to check whether the tool is installed. */
  bin?: string;
}

export const UPSTREAMS: Upstream[] = [
  {
    id: 'squeeze',
    repo: 'NourEldinShobier/squeeze',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'squeeze',
    plugin: 'squeeze',
    version: '0.1.0',
    commit: '6b79559b8684',
    why: 'Shrinks long Bash and PowerShell output before Claude reads it; the full text is saved to a file. 79–93% smaller on real commands.',
    ours: 'Ours. Separate repo so it can be installed alone.',
  },
  {
    id: 'stash',
    repo: 'NourEldinShobier/stash',
    license: 'MIT',
    kind: 'plugin',
    marketplace: 'stash',
    plugin: 'stash',
    version: '0.1.0',
    commit: '8d789af403da',
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
    version: '0.6.1',
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
];

export const byId = (id: string) => UPSTREAMS.find((u) => u.id === id);
export const plugins = () => UPSTREAMS.filter((u) => u.kind === 'plugin');
export const tools = () => UPSTREAMS.filter((u) => u.kind !== 'plugin');
