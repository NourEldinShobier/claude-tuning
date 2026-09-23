/**
 * Runs each tool's real official installer, exactly as setup does, and checks the tool works afterwards.
 * CI runs it on macOS, Linux and Windows. Locally it skips tools that are already installed.
 * Tools not offered on this platform, and MCP servers registered through the claude CLI when it is absent, are skipped.
 */
import { has, isInstalled, runInstaller, versionOf } from '../src/setup';
import { tools, type Platform } from '../src/upstreams';

const [node = 0] = await versionOf(['node', '--version']);
const claude = await has('claude');
let failed = 0;
for (const u of tools()) {
  const cmd = u.install?.[process.platform as Platform];
  const skip = !cmd ? 'not on this platform' : (u.node ?? 0) > node ? `needs Node ${u.node}` : cmd.startsWith('claude ') && !claude ? 'needs the claude CLI' : (await isInstalled(u)) ? 'already installed' : '';
  if (skip) {
    console.log(`${u.id}: skipped, ${skip}`);
    continue;
  }
  const r = await runInstaller(cmd!);
  const ok = await isInstalled(u);
  console.log(`${u.id}: ${ok ? 'installed and runs' : 'FAILED'}`);
  if (!ok) {
    failed++;
    console.log(r.output.split('\n').slice(-20).join('\n'));
  }
}
process.exit(failed ? 1 : 0);
