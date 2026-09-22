/** Runs shell commands and code snippets in subprocesses, cross-platform, with a hard timeout. */
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RunResult { exitCode: number; output: string; timedOut: boolean }

const works = (cmd: string[]) => {
  try {
    return Bun.spawnSync(cmd, { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0;
  } catch {
    return false;
  }
};

let shellCache: string[] | undefined;
export function shell(): string[] {
  shellCache ??=
    process.platform === 'win32'
      ? works(['bash', '--version']) ? ['bash', '-c'] : ['powershell', '-NoProfile', '-Command']
      : Bun.which('bash') ? ['bash', '-c'] : ['sh', '-c'];
  return shellCache;
}

let pythonCache: string | null | undefined;
function python(): string | null {
  // On Windows `python3` is often the Microsoft Store stub, which exists but fails; hence the --version probe.
  const names = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  if (pythonCache === undefined) pythonCache = names.find((n) => works([n, '--version'])) ?? null;
  return pythonCache;
}

export const stripAnsi = (s: string) =>
  s.replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g, '').replace(/\r\n/g, '\n');

async function drain(stream: ReadableStream<Uint8Array>, sink: Uint8Array[]) {
  for await (const c of stream) sink.push(c);
}

export async function run(argv: string[], cwd: string, timeoutSec: number): Promise<RunResult> {
  let proc;
  try {
    proc = Bun.spawn(argv, { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: { ...process.env, NO_COLOR: '1' } });
  } catch (e) {
    return { exitCode: 127, output: `stash: could not start ${argv[0]}: ${(e as Error).message}`, timedOut: false };
  }
  const out: Uint8Array[] = [];
  const err: Uint8Array[] = [];
  const reading = Promise.all([drain(proc.stdout, out), drain(proc.stderr, err)]);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // Killing bash alone on Windows leaves its children running and holding the pipes.
    if (process.platform === 'win32') Bun.spawnSync(['taskkill', '/T', '/F', '/PID', String(proc.pid)], { stdout: 'ignore', stderr: 'ignore' });
    else proc.kill('SIGKILL');
  }, timeoutSec * 1000);
  const exitCode = await proc.exited;
  clearTimeout(timer);
  // A backgrounded grandchild can keep the pipes open forever; don't wait on it.
  await Promise.race([reading, Bun.sleep(timedOut ? 500 : 2000)]);
  const stdout = Buffer.concat(out).toString('utf8');
  const stderr = Buffer.concat(err).toString('utf8');
  const output = stripAnsi(stdout && stderr ? `${stdout}${stdout.endsWith('\n') ? '' : '\n'}${stderr}` : stdout || stderr);
  return { exitCode, output, timedOut };
}

export const runShell = (command: string, cwd: string, timeoutSec: number) => run([...shell(), command], cwd, timeoutSec);

export type Language = 'javascript' | 'typescript' | 'python' | 'shell';

export async function runCode(language: Language, code: string, timeoutSec: number): Promise<RunResult> {
  if (language === 'shell') return runShell(code, process.cwd(), timeoutSec);
  const py = language === 'python' ? python() : null;
  if (language === 'python' && !py) return { exitCode: 127, output: 'stash: no working python found on PATH', timedOut: false };
  const file = join(tmpdir(), `stash-${crypto.randomUUID()}.${{ javascript: 'js', typescript: 'ts', python: 'py' }[language]}`);
  writeFileSync(file, code);
  try {
    return await run(py ? [py, file] : [process.execPath, file], process.cwd(), timeoutSec);
  } finally {
    rmSync(file, { force: true });
  }
}
