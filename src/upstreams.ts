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
  /** Install command per platform, for `kind: 'cli' | 'mcp'`; run by the user, never by us. */
  install?: { darwin: string; linux: string; win32: string };
}

export const UPSTREAMS: Upstream[] = [
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
    id: 'context-mode',
    repo: 'mksglu/context-mode',
    license: 'Elastic-2.0',
    kind: 'plugin',
    marketplace: 'context-mode',
    plugin: 'context-mode',
    version: '1.0.169',
    commit: '6f0cc6841c68',
    why: 'Runs big commands, files and pages in a sandbox and returns only the derived answer, so raw bytes stay out of the context window.',
    ours: 'Its session-start injection is capped to fit Claude Code\'s 10,000-character hook limit (src/cap-context-mode.ts); above that the model only receives a 2 KB preview and loses the routing rules.',
  },
  {
    id: 'context7',
    repo: 'upstash/context7',
    license: 'none',
    kind: 'plugin',
    marketplace: 'context7-marketplace',
    plugin: 'context7',
    version: '1.0.2',
    commit: 'c3248289c2ad',
    why: 'Current library and framework documentation, instead of the model answering from memory.',
  },
  {
    id: 'rtk',
    repo: 'rtk-ai/rtk',
    license: 'none',
    kind: 'cli',
    version: '0.10.0',
    why: 'Compresses shell output (git, tests, builds) before it reaches the model. Hooked on every Bash and PowerShell call.',
    install: { darwin: 'brew install rtk', linux: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh', win32: 'winget install rtk-ai.rtk' },
  },
  {
    id: 'codebase-memory',
    repo: 'DeusData/codebase-memory-mcp',
    license: 'none',
    kind: 'mcp',
    version: '0.11.0',
    why: 'Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context.',
    ours: 'The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search.',
    install: {
      darwin: 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash',
      linux: 'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash',
      win32: 'irm https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1; Unblock-File .\\install.ps1; .\\install.ps1',
    },
  },
];

export const byId = (id: string) => UPSTREAMS.find((u) => u.id === id);
export const plugins = () => UPSTREAMS.filter((u) => u.kind === 'plugin');
export const tools = () => UPSTREAMS.filter((u) => u.kind !== 'plugin');
