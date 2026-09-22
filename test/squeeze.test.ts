import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clean, gitDiff, gitLog, gitStatus, headTail, install, listing, squeeze, tests } from '../src/squeeze/filters';

process.env.SQUEEZE_DIR = mkdtempSync(join(tmpdir(), 'squeeze-'));
delete process.env.TYPESAFE_API_KEY; // keep the hook offline
const { squeezeResult } = await import('../src/squeeze/hook');

const rep = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('\n');

describe('clean', () => {
  test('strips ANSI, redraws, progress and repeats', () => {
    const out = clean('\x1b[32mok\x1b[0m\n10%\r50%\r100% done\nx\nx\nx\n\n\n\n\nend');
    expect(out).toBe('ok\nx\n  … repeated 2 more times\n\n\nend');
  });
  test('keeps progress-looking lines that carry an error', () => {
    expect(clean('50% error: disk full')).toBe('50% error: disk full');
  });
});

test('headTail keeps error lines from the middle', () => {
  const text = rep(300, (i) => (i === 150 ? 'Error: boom' : `line ${i}`));
  const out = headTail(text);
  expect(out).toContain('Error: boom');
  expect(out).toContain('line 0');
  expect(out).toContain('line 299');
  expect(out).not.toContain('line 120');
});

test('gitStatus drops hints and caps sections', () => {
  const text = `On branch main\nChanges not staged for commit:\n  (use "git add <file>..." to update)\n${rep(40, (i) => `\tmodified:   f${i}.ts`)}\n`;
  const out = gitStatus(text)!;
  expect(out).not.toContain('(use "git');
  expect(out).toContain('… 15 more');
  expect(gitStatus('random text')).toBeNull();
});

test('gitLog makes one line per commit', () => {
  const text = 'commit abcdef1234567890\nAuthor: A B <a@b.c>\nDate:   Mon Sep 22 10:00:00 2026 +0200\n\n    Fix thing\n\n    body\n\ncommit 1234567abcdef\nAuthor: C <c@d.e>\nDate:   Sun Sep 21 09:00:00 2026 +0200\n\n    Add stuff\n';
  expect(gitLog(text)!.split('\n')).toEqual(['abcdef123 Sep 22 2026 A B: Fix thing', '1234567ab Sep 21 2026 C: Add stuff']);
});

test('gitDiff drops index lines and caps each file', () => {
  const text = `diff --git a/x.ts b/x.ts\nindex 1234abc..5678def 100644\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n${rep(100, (i) => `+l${i}`)}`;
  const out = gitDiff(text)!;
  expect(out).not.toContain('index 1234abc');
  expect(out).toMatch(/… \d+ more diff lines in x\.ts/);
});

test('tests hides passing lines and keeps failures', () => {
  const text = `${rep(30, (i) => `(pass) case ${i}`)}\n(fail) broken case\nerror: expected 1, got 2\n 30 pass\n 1 fail`;
  const out = tests(text)!;
  expect(out).toContain('(fail) broken case');
  expect(out).toContain('expected 1, got 2');
  expect(out).not.toContain('case 3\n');
  expect(out).toContain('30 passing test lines hidden');
});

test('install keeps warnings and summary', () => {
  const text = `${rep(50, (i) => `+ pkg${i}@1.0.0`)}\nwarn: deprecated foo\n50 packages installed`;
  const out = install(text, 'bun install')!;
  expect(out).toContain('deprecated foo');
  expect(out).toContain('50 packages installed');
  expect(install(text, 'echo hi')).toBeNull();
});

test('listing summarises long listings', () => {
  const text = rep(200, (i) => `src/f${i}.${i % 2 ? 'ts' : 'md'}`);
  const out = listing(text, 'find . -type f')!;
  expect(out).toContain('200 total');
  expect(out).toContain('.ts 100');
  expect(listing(text, 'cat x')).toBeNull();
});

test('squeeze routes by command', () => {
  expect(squeeze('On branch main\nnothing to commit', 'git status').kind).toBe('git-status');
  expect(squeeze('hello', 'echo hello').kind).toBe('generic');
});

describe('squeezeResult', () => {
  const big = rep(400, (i) => `row ${i} ${'x'.repeat(30)}`);
  const signal = AbortSignal.timeout(5000);
  test('leaves small output alone', async () => {
    expect(await squeezeResult('echo hi', 'x', { stdout: 'hi' }, signal)).toBeNull();
  });
  test('skips opt-out commands', async () => {
    expect(await squeezeResult('SQUEEZE=0 cat big', 'x', { stdout: big }, signal)).toBeNull();
  });
  test('squeezes big output, saves the full text and keeps other fields', async () => {
    const r = (await squeezeResult('cat big.txt', undefined, { stdout: big, stderr: '', interrupted: false }, signal))!;
    expect(r.interrupted).toBe(false);
    expect(r.stdout!.length).toBeLessThan(big.length / 2);
    const file = /Full output: (.+?) —/.exec(r.stdout!)![1]!;
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(big);
  });
});
