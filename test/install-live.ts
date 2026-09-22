/**
 * Runs each tool's real official installer, exactly as setup does, and checks the tool works afterwards.
 * CI runs it on macOS, Linux and Windows. Locally it skips tools that are already installed.
 */
import { hasBin, runInstaller } from '../src/setup';
import { tools } from '../src/upstreams';

let failed = 0;
for (const u of tools()) {
  if (!u.bin || !u.install) continue;
  if (await hasBin(u.bin)) {
    console.log(`${u.id}: already installed, skipped`);
    continue;
  }
  const r = await runInstaller(u.install[process.platform as 'darwin' | 'linux' | 'win32']);
  const ok = await hasBin(u.bin);
  console.log(`${u.id}: ${ok ? 'installed and runs' : 'FAILED'}`);
  if (!ok) {
    failed++;
    console.log(r.output.split('\n').slice(-20).join('\n'));
  }
}
process.exit(failed ? 1 : 0);
