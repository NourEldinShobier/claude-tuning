#!/usr/bin/env bun
/**
 * `bun run upstreams` — compares each pinned version in src/upstreams.ts with the upstream's latest
 * release (falling back to the newest tag, then the default branch's last commit) and prints what moved.
 * Read-only. Uses GITHUB_TOKEN when set, to raise the rate limit. `--json` for machine output.
 */
import { UPSTREAMS, type Upstream } from './upstreams';

const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'claude-tuning' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function api<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.github.com/repos/${path}`, { headers, signal: AbortSignal.timeout(15_000) });
  return res.ok ? ((await res.json()) as T) : null;
}

export interface Latest {
  version?: string;
  published?: string;
  commit?: string;
  url?: string;
}

export async function latest(repo: string): Promise<Latest> {
  const release = await api<{ tag_name: string; published_at: string; html_url: string }>(`${repo}/releases/latest`);
  if (release) return { version: release.tag_name.replace(/^v/, ''), published: release.published_at.slice(0, 10), url: release.html_url };
  const tags = await api<{ name: string; commit: { sha: string } }[]>(`${repo}/tags`);
  if (tags?.length) return { version: tags[0]!.name.replace(/^v/, ''), commit: tags[0]!.commit.sha, url: `https://github.com/${repo}/tags` };
  const commits = await api<{ sha: string; commit: { committer: { date: string } } }[]>(`${repo}/commits?per_page=1`);
  if (commits?.length) return { commit: commits[0]!.sha, published: commits[0]!.commit.committer.date.slice(0, 10), url: `https://github.com/${repo}/commits` };
  return {};
}

/** Behind when the version differs, or (no versions published) when the default branch moved past our pin. */
export function isBehind(u: Upstream, l: Latest): boolean {
  if (l.version) return l.version !== u.version;
  if (l.commit && u.commit) return !l.commit.startsWith(u.commit) && !u.commit.startsWith(l.commit);
  return false;
}

if (import.meta.main) {
  const rows = await Promise.all(
    UPSTREAMS.map(async (u) => {
      const l = await latest(u.repo);
      return { id: u.id, repo: u.repo, pinned: u.version, latest: l.version ?? (l.commit ? `${l.commit.slice(0, 7)} (no releases)` : 'unknown'), date: l.published ?? '', behind: isBehind(u, l), url: l.url ?? `https://github.com/${u.repo}` };
    })
  );
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const w = Math.max(...rows.map((r) => r.id.length));
    for (const r of rows) console.log(`${r.behind ? '↑' : ' '} ${r.id.padEnd(w)}  pinned ${r.pinned.padEnd(10)} latest ${String(r.latest).padEnd(22)} ${r.date}`);
    const behind = rows.filter((r) => r.behind);
    console.log(`\n${behind.length} of ${rows.length} have moved${behind.length ? `: ${behind.map((b) => `${b.id} → ${b.latest} (${b.url})`).join(', ')}` : ''}`);
    console.log('To adopt one: read its changelog, update the version (and commit) in src/upstreams.ts, run bun test, then bun run setup --apply.');
  }
}
