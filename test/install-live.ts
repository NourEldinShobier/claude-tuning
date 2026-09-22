/**
 * Runs each tool's real official installer, exactly as setup does, and checks the tool works afterwards.
 * CI runs it on macOS, Linux and Windows. Locally it skips tools that are already installed.
 */
import { hasBin, shellFor } from '../src/setup';
import { tools } from '../src/upstreams';

let failed = 0;
for (const u of tools()) {
  if (!u.bin || !u.install) continue;
  if (await hasBin(u.bin)) {
    console.log(`${u.id}: already installed, skipped`);
    continue;
  }
  const p = Bun.spawn(shellFor(u.install[process.platform as 'darwin' | 'linux' | 'win32']), { stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const ok = await hasBin(u.bin);
  console.log(`${u.id}: ${ok ? 'installed and runs' : 'FAILED'}`);
  if (!ok) {
    failed++;
    console.log(`${out}\n${err}`.trim().split('\n').slice(-20).join('\n'));
  }
}
process.exit(failed ? 1 : 0);
