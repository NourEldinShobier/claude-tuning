/**
 * Compares output size for real commands: raw and through squeeze.
 * Run from any git repo: `bun bench/squeeze.ts [repo-dir]`. Characters / 4 ≈ tokens.
 */
import { squeeze } from '../src/squeeze/filters';

const cwd = process.argv[2] ?? process.cwd();
const CASES: [string, string[]][] = [
  ['git log -30', ['git', 'log', '-30']],
  ['git log --stat -15', ['git', 'log', '--stat', '-15']],
  ['git show HEAD~1', ['git', 'show', 'HEAD~1']],
  ['git diff HEAD~5', ['git', 'diff', 'HEAD~5']],
  ['git ls-files', ['git', 'ls-files']],
  ['find . -type f', ['find', '.', '-type', 'f', '-not', '-path', './.git/*', '-not', '-path', './node_modules/*']],
  ['bun test', ['bun', 'test']],
];

const run = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, NO_COLOR: '1' } });
  return p.stdout.toString() + p.stderr.toString();
};

const rows: string[] = ['| command | raw | squeeze | saved |', '|---|---:|---:|---:|'];
let rawSum = 0;
let sqSum = 0;
for (const [name, cmd] of CASES) {
  const raw = run(cmd);
  const sq = raw.length < 2500 ? raw : squeeze(raw, cmd.join(' ')).text;
  rawSum += raw.length;
  sqSum += sq.length;
  rows.push(`| \`${name}\` | ${raw.length.toLocaleString('en-US')} | ${sq.length.toLocaleString('en-US')} | ${Math.round((1 - sq.length / Math.max(1, raw.length)) * 100)}% |`);
}
rows.push(`| **total** | ${rawSum.toLocaleString('en-US')} | ${sqSum.toLocaleString('en-US')} | ${Math.round((1 - sqSum / rawSum) * 100)}% |`);
console.log(rows.join('\n'));
