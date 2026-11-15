import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { ask, resolveKey, splitArgv } from '../src/jev';

const bun = (code: string) => `"${process.execPath}" -e "${code}"`;

describe('splitArgv', () => {
  test('splits on whitespace and keeps quoted text together', () => {
    expect(splitArgv(`op read 'op://my vault/item/field'`)).toEqual(['op', 'read', 'op://my vault/item/field']);
    expect(splitArgv(String.raw`"C:\Program Files\x.exe" -e "console.log('a b')" ""`)).toEqual([String.raw`C:\Program Files\x.exe`, '-e', "console.log('a b')", '']);
    expect(splitArgv('   ')).toEqual([]);
  });
});

describe('resolveKey', () => {
  test('the env var wins and the command is not run', async () => {
    const marker = join(mkdtempSync(join(tmpdir(), 'jev-key-')), 'ran');
    const cmd = bun(`require('fs').writeFileSync('${marker.split(sep).join('/')}','x');console.log('from-command')`);
    expect(await resolveKey({ TYPESAFE_API_KEY: 'from-env', TYPESAFE_API_KEY_COMMAND: cmd })).toBe('from-env');
    expect(() => readFileSync(marker)).toThrow();
  });

  test('an empty env var falls through to the command; first line, trimmed', async () => {
    expect(await resolveKey({ TYPESAFE_API_KEY: '', TYPESAFE_API_KEY_COMMAND: bun(`console.log('  test-key  ');console.log('second')`) })).toBe('test-key');
  });

  test('command success', async () => {
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: bun(`console.log('test-key')`) })).toBe('test-key');
  });

  test('nothing set, empty output, oversized output, failing command, missing program and timeout all give undefined', async () => {
    expect(await resolveKey({})).toBeUndefined();
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: bun(`console.log('')`) })).toBeUndefined();
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: bun(`console.log('x'.repeat(4097))`) })).toBeUndefined();
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: bun(`console.log('leaky-key');process.exit(1)`) })).toBeUndefined();
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: 'no-such-program-claude-tuning' })).toBeUndefined();
    expect(await resolveKey({ TYPESAFE_API_KEY_COMMAND: bun(`setTimeout(()=>{},10000);console.log('slow-key')`) }, 300)).toBeUndefined();
  });
});

describe('the key never leaks', () => {
  test('a Jev HTTP error does not contain the key', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    const saved = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = 'secret-test-key';
    try {
      const err = await ask({}, {}, AbortSignal.timeout(1000)).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('Jev HTTP 401');
    } finally {
      globalThis.fetch = real;
      if (saved === undefined) delete process.env.TYPESAFE_API_KEY;
      else process.env.TYPESAFE_API_KEY = saved;
    }
  });
});

describe('route-model hook', () => {
  test('carries on without a key when the key command fails', async () => {
    const env = { ...process.env, TYPESAFE_API_KEY_COMMAND: bun(`console.log('leaky-key');process.exit(1)`) } as Record<string, string>;
    delete env.TYPESAFE_API_KEY;
    const proc = Bun.spawn([process.execPath, 'src/route-model.ts'], {
      env,
      stdin: new Blob([JSON.stringify({ tool_input: { prompt: 'Refactor the auth module across all files', subagent_type: 'general-purpose' } })]),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    expect(code).toBe(0);
    expect(out).toBe('');
    expect(err + out).not.toContain('leaky-key');
  });
});
