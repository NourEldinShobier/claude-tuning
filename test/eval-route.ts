/** Live check against Jev: `bun test/eval-route.ts`. true = should run on Opus. */
import { isComplex, judge } from '../src/route-model';

const CASES: [string, string, boolean][] = [
  ['Refactor auth to sessions', 'Replace JWT auth with server-side sessions across src/auth, src/api/middleware and the React login flow. Keep existing tests passing and add session expiry.', true],
  ['Fix race in upload queue', 'Uploads sometimes finish twice and corrupt the manifest. Find the cause in src/queue/*.ts (probably concurrent workers) and fix it.', true],
  ['Design plugin system', 'Design and implement a plugin system for the CLI: discovery, a typed API, lifecycle hooks and sandboxing. Touch cli.ts, a new plugins/ folder and docs.', true],
  ['Speed up search index', 'Search takes 4 s on 50k files. Profile src/index/*.ts, find the hot path and make it at least 5x faster without changing results.', true],
  ['Port parser to Rust', 'Rewrite the TypeScript markdown parser in src/parser as a Rust crate with the same output on the test fixtures, and wire it in through napi.', true],
  ['Implement offline sync', 'Add offline support: queue writes in IndexedDB, replay on reconnect, resolve conflicts last-write-wins with per-field timestamps. Update store, api and service worker.', true],
  ['Find API endpoints', 'List every HTTP endpoint defined in this repo with its file and line.', false],
  ['Research Jina pricing', 'Find the current Jina Reader and Search API pricing and rate limits and report back with sources.', false],
  ['Rename variable', 'In src/utils.ts rename the variable `foo` to `count` everywhere it is used. Nothing else.', false],
  ['Summarize the README', 'Read README.md and docs/ and summarize what this project does in 5 bullets.', false],
  ['Bump version', 'Change "version" from 0.6.0 to 0.6.1 in package.json and .claude-plugin/plugin.json.', false],
  ['Check who calls parse()', 'Find every caller of parse() in src and list them with file:line.', false],
  ['Fix typo in docs', 'docs/cli.md line 40 says "recieve"; change it to "receive".', false],
  ['Review diff for bugs', 'Read the current git diff and list anything that looks like a bug. Do not edit files.', false],
];

let right = 0;
const t0 = performance.now();
const results = await Promise.all(
  CASES.map(async ([description, prompt, want]) => {
    const t = performance.now();
    const s = await judge({ description, prompt, subagent_type: 'general-purpose' }, AbortSignal.timeout(8000));
    return { description, want, s, got: isComplex(s.complex, s.mechanical), ms: Math.round(performance.now() - t) };
  })
);
for (const r of results) {
  if (r.got === r.want) right++;
  console.log(
    `${r.got === r.want ? 'ok  ' : 'MISS'} ${String(r.ms).padStart(5)} ms  want ${r.want ? 'opus  ' : 'sonnet'} got ${r.got ? 'opus  ' : 'sonnet'}  complex ${r.s.complex.toFixed(2)} mechanical ${r.s.mechanical.toFixed(2)}  | ${r.description}`
  );
}
console.log(`\n${right}/${CASES.length} right, ${Math.round(performance.now() - t0)} ms wall`);
