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
      `| ${u.id} | [${u.repo}](https://github.com/${u.repo}) | ${u.license === 'none' ? '**none declared**' : u.license} | ${u.version}${u.commit ? ` (\`${u.commit.slice(0, 7)}\`)` : ''} | ${u.why} | ${u.ours ?? '—'} |`
  ),
  '',
  '## Licences',
  '',
  '- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.',
  '- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.',
  '',
  '## Ours',
  '',
  'stash and web-search are written by us, from scratch, and live in their own repositories so each can be installed alone. This bundle pins them like any other upstream.',
  '',
  'Anything written in this repository is ours and MIT-licensed. Where an idea came from someone else, the file that implements it says so.',
  '',
];

await Bun.write(`${import.meta.dir}/../UPSTREAMS.md`, `${lines.join('\n')}`);
console.log(`UPSTREAMS.md written (${UPSTREAMS.length} entries)`);
