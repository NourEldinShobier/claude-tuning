/**
 * squeeze: shrinks shell output before the model reads it. Written from observed command output,
 * not from any other tool's source. Every filter is lossy by design; the hook saves the full output
 * to a file and names it, so nothing is out of reach.
 */

/** Lines that must survive any cut: failures, errors, warnings, stack frames. */
export const IMPORTANT = /\b(error|errors|fail(ed|ure|ing)?|panic(ked)?|exception|traceback|fatal|warn(ing)?|denied|not found|undefined reference|cannot|could not|unable to|segmentation fault|assert(ion)?)\b|✗|×|❌|^\s*at \S.*[:(]\d+/i;

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)/g;
const PROGRESS = /^\s*(\d{1,3}(\.\d+)?\s?%|[━─█▓▒░#=>.\-]{8,}|\[[#=>. -]{5,}\]|(downloading|resolving|fetching|extracting|linking|receiving objects|resolving deltas|counting objects|compressing objects|enumerating objects|writing objects|unpacking objects|remote: (counting|compressing|enumerating|total))\b.*\d)/i;

export const lines = (s: string) => s.split(/\r?\n/);

/** Carriage returns redraw a line in place; keep only its final state. */
const lastRedraw = (line: string) => {
  const i = line.lastIndexOf('\r');
  return i >= 0 ? line.slice(i + 1) : line;
};

/** Applies to every output: ANSI codes, redraws, progress bars, trailing spaces, repeated lines, blank runs. */
export function clean(text: string): string {
  const out: string[] = [];
  let repeat = 0;
  for (const raw of text.replace(ANSI, '').split('\n')) {
    const line = lastRedraw(raw).replace(/\s+$/, '');
    if (PROGRESS.test(line) && !IMPORTANT.test(line)) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined && line === prev && line !== '') {
      repeat++;
      continue;
    }
    if (repeat) out.push(`  … repeated ${repeat} more time${repeat > 1 ? 's' : ''}`), (repeat = 0);
    if (line === '' && prev === '' && out[out.length - 2] === '') continue;
    out.push(line);
  }
  if (repeat) out.push(`  … repeated ${repeat} more time${repeat > 1 ? 's' : ''}`);
  return out.join('\n').replace(/^\n+|\n+$/g, '');
}

/** Keeps the first `head` and last `tail` lines; from the middle keeps only important lines (up to `keep`). */
export function headTail(text: string, head = 60, tail = 40, keep = 40): string {
  const ls = lines(text);
  if (ls.length <= head + tail + 5) return text;
  const middle = ls.slice(head, ls.length - tail);
  const kept = middle.filter((l) => IMPORTANT.test(l)).slice(0, keep);
  const note = `… ${middle.length - kept.length} lines omitted${kept.length ? `; ${kept.length} error/warning lines kept below` : ''} …`;
  return [...ls.slice(0, head), note, ...kept, ...(kept.length ? ['…'] : []), ...ls.slice(-tail)].join('\n');
}

// ---------------------------------------------------------------------------
// Command-specific filters. Each returns null when it does not apply, so the caller falls through.

/** git status: keep headings and counts; long file lists are cut per section. */
export function gitStatus(text: string, perSection = 25): string | null {
  if (!/^On branch |^HEAD detached|^Changes (not staged|to be committed)|^Untracked files|^nothing to commit/m.test(text)) return null;
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    out.push(...run.slice(0, perSection));
    if (run.length > perSection) out.push(`\t… ${run.length - perSection} more`);
    run = [];
  };
  for (const line of lines(text)) {
    if (/^\s*\(use "git /.test(line)) continue; // the hints repeat on every call
    if (/^\t/.test(line)) run.push(line);
    else flush(), out.push(line);
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** git log (full format): one line per commit, keeping any --stat summary. */
export function gitLog(text: string): string | null {
  if (!/^commit [0-9a-f]{7,40}/m.test(text)) return null;
  const out: string[] = [];
  let cur: { hash: string; author?: string; date?: string; subject?: string; stat?: string } | null = null;
  const push = () => cur && out.push(`${cur.hash.slice(0, 9)} ${cur.date ?? ''} ${cur.author ?? ''}: ${cur.subject ?? ''}${cur.stat ? `  (${cur.stat})` : ''}`.replace(/\s+/g, ' ').trim());
  for (const line of lines(text)) {
    const c = /^commit ([0-9a-f]{7,40})/.exec(line);
    if (c) {
      push();
      cur = { hash: c[1]! };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('Author:')) cur.author = line.slice(7).replace(/<[^>]*>/, '').trim();
    else if (line.startsWith('Date:')) cur.date = line.slice(5).trim().replace(/^\w{3} /, '').replace(/ \d{2}:\d{2}:\d{2}/, '').replace(/ [+-]\d{4}$/, '');
    else if (!cur.subject && /^\s{4}\S/.test(line)) cur.subject = line.trim();
    else if (/\d+ files? changed/.test(line)) cur.stat = line.trim();
  }
  push();
  return out.join('\n');
}

/** git diff: drop index lines, cap each file's hunks. */
export function gitDiff(text: string, perFile = 80): string | null {
  if (!/^diff --git /m.test(text)) return null;
  const out: string[] = [];
  let shown = 0;
  let hidden = 0;
  let file = '';
  const flush = () => hidden && out.push(`… ${hidden} more diff lines in ${file}`);
  for (const line of lines(text)) {
    if (line.startsWith('diff --git ')) {
      flush();
      file = line.replace(/^diff --git a\/(\S+).*/, '$1');
      shown = hidden = 0;
      out.push(line);
      continue;
    }
    if (/^index [0-9a-f]+\.\.[0-9a-f]+/.test(line) || /^(new|deleted) file mode|^similarity index/.test(line)) continue;
    if (shown < perFile || /^@@/.test(line)) {
      if (/^@@/.test(line) && shown >= perFile) {
        hidden++;
        continue;
      }
      out.push(line);
      shown++;
    } else hidden++;
  }
  flush();
  return out.join('\n');
}

/** Test runners: drop passing tests, keep failures (with their details) and the summary. */
export function tests(text: string): string | null {
  const summary = /(\d+ pass(ed|ing)?|\d+ fail(ed|ures?)?|Tests?:\s+\d+|test result:|=+ .*(passed|failed).* =+|^(ok|FAIL|PASS)\s+\S+\s+[\d.]+s|Ran \d+ tests?)/im;
  if (!summary.test(text)) return null;
  const pass = /^\s*(✓|✔|√|\(pass\)|PASS\b|ok\s+\d*\s|test .* \.\.\. ok$|.* PASSED\b|\.+\s*$|--- PASS)/;
  const out: string[] = [];
  let passed = 0;
  for (const line of lines(text)) {
    if (pass.test(line) && !IMPORTANT.test(line)) {
      passed++;
      continue;
    }
    out.push(line);
  }
  if (!passed) return null;
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n(${passed} passing test line${passed > 1 ? 's' : ''} hidden)`;
}

/** Package managers and downloads: keep warnings, errors and the last lines (the summary). */
export function install(text: string, command: string): string | null {
  if (!/\b(npm|pnpm|yarn|bun|pip3?|uv|cargo|go|gem|composer|poetry)\s+(i|install|add|update|upgrade|ci|sync|fetch|get|build)\b/.test(command)) return null;
  const ls = lines(text);
  const important = ls.filter((l) => IMPORTANT.test(l) || /\bdeprecated\b/i.test(l));
  const tail = ls.slice(-8);
  const kept = [...new Set([...important.slice(0, 40), ...tail])];
  return `${kept.join('\n')}${ls.length > kept.length ? `\n(${ls.length - kept.length} progress/info lines hidden)` : ''}`;
}

/** Compiler and linter errors: group by file when there are many. */
export function diagnostics(text: string, max = 30): string | null {
  const re = /^(\S.*?)[(:](\d+)[,:](\d+)\)?:?\s*(error|warning)\b.*$/gim;
  const hits = [...text.matchAll(re)];
  if (hits.length < 10) return null;
  const byFile = new Map<string, number>();
  for (const h of hits) byFile.set(h[1]!, (byFile.get(h[1]!) ?? 0) + 1);
  const counts = [...byFile.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `  ${n}\t${f}`);
  const shown = hits.slice(0, max).map((h) => h[0]);
  return [`${hits.length} diagnostics in ${byFile.size} files:`, ...counts.slice(0, 20), byFile.size > 20 ? `  … ${byFile.size - 20} more files` : '', '', `First ${shown.length}:`, ...shown].filter((l) => l !== '').join('\n');
}

/** Long listings (ls, find, tree, dir): head, a count by extension, tail. */
export function listing(text: string, command: string, max = 80): string | null {
  if (!/(^|[;&|]\s*)(ls|dir|find|tree|fd|Get-ChildItem|gci|rg --files|git ls-files)\b/.test(command)) return null;
  const ls = lines(text).filter(Boolean);
  if (ls.length <= max) return null;
  const ext = new Map<string, number>();
  for (const l of ls) {
    const m = /\.([A-Za-z0-9]{1,8})\s*$/.exec(l);
    const k = m ? `.${m[1]!.toLowerCase()}` : '(no extension)';
    ext.set(k, (ext.get(k) ?? 0) + 1);
  }
  const top = [...ext.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(', ');
  return [...ls.slice(0, 50), `… ${ls.length - 60} more entries (${ls.length} total; by type: ${top}) …`, ...ls.slice(-10)].join('\n');
}

/** Which filter produced the result, for the note and the benchmark. */
export type Kind = 'git-status' | 'git-log' | 'git-diff' | 'tests' | 'install' | 'diagnostics' | 'listing' | 'generic';

/** The specific filter for this command/output, or generic cleanup plus head/tail. */
export function squeeze(text: string, command: string): { text: string; kind: Kind } {
  const c = clean(text);
  const specific: [Kind, string | null][] = [
    ['git-status', /\bgit\b.*\bstatus\b/.test(command) ? gitStatus(c) : null],
    ['git-log', /\bgit\b.*\blog\b/.test(command) ? gitLog(c) : null],
    ['git-diff', /\bgit\b.*\b(diff|show)\b/.test(command) ? gitDiff(c) : null],
    ['install', install(c, command)],
    ['tests', tests(c)],
    ['diagnostics', diagnostics(c)],
    ['listing', listing(c, command)],
  ];
  const hit = specific.find(([, t]) => t !== null);
  return hit ? { text: headTail(hit[1]!), kind: hit[0] } : { text: headTail(c), kind: 'generic' };
}
