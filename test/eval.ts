/** Live check against Jev: `bun test/eval.ts`. Expected null means no skill should be suggested. */
import { loadRoster } from '../src/roster';
import { suggest } from '../src/suggest';

const CASES: [string, string | null][] = [
  ['add a staggered word reveal animation to the hero headline', 'staggered-word-reveal'],
  ['turn this landing page hero into a webgl particle globe', 'globe-particles'],
  ['make me a pptx deck summarizing our Q3 results', 'anthropic-skills:pptx'],
  ['from now on, whenever I edit a ts file, run prettier on it automatically', 'update-config'],
  ['review my current diff for bugs before I merge', 'code-review'],
  ['what do people on reddit think of bun 1.4? search online', 'web-search:web-search'],
  ['extract the color palette from this screenshot and turn it into css variables', 'image-palette'],
  ['look up the latest Next.js docs for server actions', 'context7:docs'],
  ['explain what a monad is in simple terms', null],
  ['fix the failing test in src/cli.ts', null],
  ['rename the variable foo to count in utils.ts', null],
  ['what is the difference between let and const in javascript', null],
  ['thanks, that looks good. commit it', null],
  ['why is my rust borrow checker complaining about this lifetime', null],
];

const roster = loadRoster('D:/code/projects');
let right = 0;
const t0 = performance.now();
const results = await Promise.all(
  CASES.map(async ([prompt, want]) => {
    const t = performance.now();
    const trace: Record<string, unknown> = {};
    const got = await suggest(prompt, roster, AbortSignal.timeout(8000), trace).catch((e) => `ERROR ${e.message}`);
    return { prompt, want, got, trace, ms: Math.round(performance.now() - t) };
  })
);
for (const r of results) {
  const ok = r.got === r.want;
  if (ok) right++;
  console.log(`${ok ? 'ok  ' : 'MISS'} ${String(r.ms).padStart(5)} ms  want ${r.want ?? '-'}  got ${r.got ?? '-'}  | ${r.prompt}
        ${JSON.stringify(r.trace)}`);
}
console.log(`\n${right}/${CASES.length} right, ${roster.length} skills, ${Math.round(performance.now() - t0)} ms wall`);
