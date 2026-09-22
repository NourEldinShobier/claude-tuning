#!/usr/bin/env bun
/** Writes UPSTREAMS.md from src/upstreams.ts, so the table can never drift from what setup installs. */
import { UPSTREAMS } from './upstreams';

const lines = [
  '# Upstreams',
  '',
  'Everything this setup installs, and where it comes from. **No third-party code is copied into this repository**: each tool is installed from its own source, keeping its licence and its updates with its author.',
  '',
  'Generated from `src/upstreams.ts` by `bun run upstreams:doc`. Check for newer releases with `bun run upstreams`.',
  '',
  '| Tool | Source | Licence | Pinned | What it does | What claude-tuning changes |',
  '|---|---|---|---|---|---|',
  ...UPSTREAMS.map(
    (u) =>
      `| ${u.id} | [${u.repo}](https://github.com/${u.repo}) | ${u.license === 'none' ? '**none declared**' : u.license} | ${u.version}${u.commit ? ` (\`${u.commit.slice(0, 7)}\`)` : ''} | ${u.optional ? `**Optional** (install with \`--with=${u.id}\`): ${u.optional} ` : ''}${u.why} | ${u.ours ?? '—'} |`
  ),
  '',
  '## Licences',
  '',
  '- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.',
  '- **Elastic 2.0** (context-mode): the source may be read and used, but not offered as a hosted service and not shipped with its licence controls removed. We install it unmodified and patch only our own copy at runtime.',
  '- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.',
  '',
  '## Our own replacements',
  '',
  "- **squeeze** (`src/squeeze/`) shrinks Bash and PowerShell output after the command runs, with rules per command type (git, tests, installs, compiler errors, listings) and, for large unrecognised output, Jev picking the blocks relevant to the command's stated purpose. The full output is saved to a file named in the result. Written from observed command output, not from rtk's source.",
  "- **stash** (`src/stash/`) is an MCP server that runs commands, code, files and URLs into a local SQLite FTS5 index and returns only a preview; `stash_search` (BM25, reranked by Jev) and `stash_get` pull what is needed. Written from a behaviour brief, not from context-mode's source.",
  '',
  'Anything written in this repository is ours and MIT-licensed. Where an idea came from someone else, the file that implements it says so.',
  '',
];

await Bun.write(`${import.meta.dir}/../UPSTREAMS.md`, `${lines.join('\n')}`);
console.log(`UPSTREAMS.md written (${UPSTREAMS.length} entries)`);
