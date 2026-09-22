import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, chunk, ftsQuery } from '../src/stash/store';
import { assemble, preview } from '../src/stash/tools';
import { stripAnsi } from '../src/stash/exec';

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'stash-test-'));
  dirs.push(d);
  return d;
};
const stores: Store[] = [];
const newStore = (project = 'p1', dir = tempDir()) => {
  const s = new Store(dir, project);
  stores.push(s);
  return s;
};
afterAll(() => {
  stores.forEach((s) => s.close());
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe('chunking', () => {
  test('markdown splits at headings, keeps line ranges and ignores # inside code fences', () => {
    const md = ['# Intro', 'hello', '', '## Install', 'run it', '```sh', '# not a heading', '```', '### Usage', 'use it'].join('\n');
    const c = chunk(md, true);
    expect(c.map((x) => x.heading)).toEqual(['Intro', 'Install', 'Usage']);
    expect(c.map((x) => [x.lineStart, x.lineEnd])).toEqual([[1, 2], [4, 8], [9, 10]]);
    expect(c[1]!.text).toContain('# not a heading');
  });

  test('long markdown sections split at blank lines within the size target', () => {
    const para = 'word '.repeat(100).trim();
    const c = chunk(['# Big', ...Array.from({ length: 20 }, () => [para, '']).flat()].join('\n'), true);
    expect(c.length).toBeGreaterThan(3);
    expect(c.every((x) => x.heading === 'Big' && x.text.length <= 2400 + 600)).toBe(true);
  });

  test('logs split every 60 lines', () => {
    const log = Array.from({ length: 150 }, (_, i) => `line ${i}`).join('\n');
    const c = chunk(log, false);
    expect(c.map((x) => [x.lineStart, x.lineEnd])).toEqual([[1, 60], [61, 120], [121, 150]]);
  });
});

describe('search', () => {
  test('query builder drops stop words and quotes terms', () => {
    expect(ftsQuery('What is the "exit" code?')).toBe('"exit" OR "code"');
    expect(ftsQuery('the')).toBe('"the"');
  });

  test('BM25 ranks the relevant chunk first and scopes by project', () => {
    const dir = tempDir();
    const s = newStore('p1', dir);
    s.add('notes', 'text', '# Cats\ncats purr and sleep\n\n# Build\nthe build failed with error TS2345 in parser.ts\n\n# Dogs\ndogs bark', true);
    const hits = s.search('why did the build fail with an error', 5);
    expect(hits[0]!.heading).toBe('Build');
    const other = newStore('p2', dir);
    expect(other.search('build error', 5)).toEqual([]);
  });

  test('odd syntax does not throw', () => {
    const s = newStore();
    s.add('x', 'text', 'NEAR AND OR "quote" col:val', false);
    expect(s.search('col:val AND "quote" (', 5).length).toBe(1);
    expect(s.search('!!!', 5)).toEqual([]);
  });
});

describe('budget', () => {
  test('assemble stays under the cap and says what was cut', () => {
    const blocks = Array.from({ length: 50 }, (_, i) => `block ${i} ` + 'x'.repeat(500));
    const out = assemble(blocks, 4000, 'use stash_get');
    expect(out.length).toBeLessThanOrEqual(4000);
    expect(out).toMatch(/more block\(s\) cut .* use stash_get/);
    expect(assemble(['a', 'b'], 4000, 'x')).toBe('a\n\nb');
    expect(assemble(['y'.repeat(9000)], 4000, 'x').length).toBeLessThanOrEqual(4000);
  });

  test('preview keeps head and tail with an omission marker', () => {
    const p = preview(Array.from({ length: 100 }, (_, i) => `l${i}`).join('\n'));
    expect(p.split('\n')).toHaveLength(15);
    expect(p).toContain('… 86 lines omitted …');
    expect(p.startsWith('l0\n')).toBe(true);
    expect(p.endsWith('l99')).toBe(true);
  });

  test('strips ANSI colour codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m\r\nok')).toBe('red\nok');
  });
});

describe('stash_get paging', () => {
  test('paging through a source returns every character exactly once', () => {
    const s = newStore();
    const content = Array.from({ length: 3000 }, (_, i) => `row ${i} ünïcødé 🎉`).join('\n');
    const { id, chunks } = s.add('big', 'text', content, false);
    let got = '';
    let offset: number | null = 0;
    while (offset !== null) {
      const p: { text: string; next: number | null } = s.page(id, offset, 7_777)!;
      got += p.text;
      offset = p.next;
    }
    expect(got).toBe(content);
    expect(s.page(`c${999999}`)).toBeNull();
    const first = s.search('row 0', 1)[0]!;
    expect(s.page(`c${first.id}`)!.text).toBe(first.text);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('server protocol', () => {
  test('initialize, tools/list, stash_run, stash_search over stdio', async () => {
    const proc = Bun.spawn([process.execPath, 'src/stash/server.ts'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
      env: { ...process.env, STASH_DIR: tempDir(), TYPESAFE_API_KEY: '' },
    });
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const next = async (): Promise<Record<string, any>> => {
      for (;;) {
        const i = buf.indexOf('\n');
        if (i >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          return JSON.parse(line);
        }
        const { value, done } = await reader.read();
        if (done) throw new Error('server closed stdout');
        buf += decoder.decode(value, { stream: true });
      }
    };
    const call = async (id: number, method: string, params?: unknown) => {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      proc.stdin.flush();
      const r = await next();
      expect(r.id).toBe(id);
      return r;
    };
    try {
      const init = await call(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
      expect(init.result.protocolVersion).toBe('2025-03-26');
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const list = await call(2, 'tools/list');
      expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
        'stash_run', 'stash_code', 'stash_index', 'stash_search', 'stash_get', 'stash_stats',
      ]);
      const run = await call(3, 'tools/call', { name: 'stash_run', arguments: { commands: [{ label: 'greet', command: 'echo hello && echo world' }] } });
      const text: string = run.result.content[0].text;
      expect(run.result.isError).toBe(false);
      expect(text).toContain('[greet] exit 0');
      expect(text).toContain('hello\nworld');
      const search = await call(4, 'tools/call', { name: 'stash_search', arguments: { queries: ['world'] } });
      expect(search.result.content[0].text).toMatch(/\[greet\] c\d+ L1-2/);
      expect((await call(5, 'nope')).error.code).toBe(-32601);
      expect((await call(6, 'ping')).result).toEqual({});
    } finally {
      proc.stdin.end();
      await proc.exited;
    }
  }, 30_000);
});
