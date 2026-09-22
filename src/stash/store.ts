/**
 * SQLite store for stash: every source is kept whole (so stash_get is lossless) and also cut into chunks
 * indexed with FTS5, so a search returns a few passages instead of the whole thing.
 */
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Chunk size targets in chars (tokens × 4). */
const MIN = 600;
const MAX = 2400;
const LOG_LINES = 60;
const WEEK_MS = 7 * 24 * 3600 * 1000;

export interface Chunk { lineStart: number; lineEnd: number; heading: string; text: string }
export interface Hit { id: number; sourceId: string; label: string; lineStart: number; lineEnd: number; heading: string; text: string }
export interface Source { id: string; label: string; kind: string; bytes: number; content: string }

const STOP = new Set(
  'a an and are as at be but by can do does for from how i if in into is it its of on or s so that the their then there these this to was what when where which who why will with you your'.split(' '),
);

export const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

/**
 * Markdown breaks at #..### headings (never inside code fences); logs at blank lines or every LOG_LINES lines.
 * Either way a chunk ends at a blank line once it reaches MIN, and at any line once it reaches MAX.
 */
export function chunk(text: string, markdown: boolean): Chunk[] {
  const lines = text.split('\n');
  const out: Chunk[] = [];
  let cur: string[] = [];
  let size = 0;
  let start = 0;
  let heading = '';
  let curHeading = '';
  let fence = false;
  const flush = (end: number) => {
    while (cur.length && !cur[cur.length - 1]!.trim()) (cur.pop(), end--);
    if (cur.some((l) => l.trim())) out.push({ lineStart: start + 1, lineEnd: end, heading: curHeading, text: cur.join('\n') });
    cur = [];
    size = 0;
  };
  lines.forEach((line, i) => {
    if (markdown && /^(```|~~~)/.test(line)) fence = !fence;
    const h = markdown && !fence ? /^#{1,3}\s+(.+)/.exec(line) : null;
    if (h) {
      flush(i);
      heading = h[1]!.replace(/#+\s*$/, '').trim();
    } else if (cur.length && (size >= MAX || (!line.trim() && size >= MIN) || (!markdown && cur.length >= LOG_LINES))) flush(i);
    if (!cur.length) {
      start = i;
      curHeading = heading;
    }
    cur.push(line);
    size += line.length + 1;
  });
  flush(lines.length);
  return out;
}

/** Quoted OR-terms: quoting keeps FTS5 syntax characters in user text from being parsed as operators. */
export function ftsQuery(query: string): string {
  const words = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])];
  const kept = words.filter((w) => !STOP.has(w));
  return (kept.length ? kept : words).map((w) => `"${w}"`).join(' OR ');
}

export const projectOf = (cwd: string) => Bun.hash(process.platform === 'win32' ? cwd.toLowerCase() : cwd).toString(36).slice(0, 8);

export class Store {
  readonly db: Database;
  readonly session = { stored: 0, returned: 0 };

  constructor(dir = process.env.STASH_DIR || join(homedir(), '.cache', 'claude-tuning'), readonly project = projectOf(process.cwd())) {
    mkdirSync(dir, { recursive: true });
    this.db = new Database(join(dir, 'stash.db'), { create: true });
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, project TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL,
        bytes INTEGER NOT NULL, created INTEGER NOT NULL, content TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sources_project ON sources(project, created);
      CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, seq INTEGER NOT NULL,
        line_start INTEGER NOT NULL, line_end INTEGER NOT NULL, heading TEXT NOT NULL, text TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS chunks_source ON chunks(source_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(text, heading, tokenize='porter unicode61');
      CREATE TABLE IF NOT EXISTS counters(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    `);
  }

  add(label: string, kind: string, content: string, markdown: boolean): { id: string; chunks: Chunk[] } {
    const id = 's' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const chunks = chunk(content, markdown);
    const n = bytes(content);
    this.db.transaction(() => {
      this.db.query('INSERT INTO sources VALUES (?,?,?,?,?,?,?)').run(id, this.project, label, kind, n, Date.now(), content);
      const ins = this.db.query('INSERT INTO chunks(source_id,seq,line_start,line_end,heading,text) VALUES (?,?,?,?,?,?) RETURNING id');
      const fts = this.db.query('INSERT INTO fts(rowid,text,heading) VALUES (?,?,?)');
      chunks.forEach((c, i) => {
        const row = ins.get(id, i, c.lineStart, c.lineEnd, c.heading, c.text) as { id: number };
        fts.run(row.id, c.text, c.heading);
      });
    })();
    this.count('stored', n);
    return { id, chunks };
  }

  count(key: 'stored' | 'returned', n: number) {
    this.session[key] += n;
    this.db.query('INSERT INTO counters VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value').run(key, n);
  }

  totals(): { stored: number; returned: number; sources: number; sourceBytes: number } {
    const c = Object.fromEntries((this.db.query('SELECT key, value FROM counters').all() as { key: string; value: number }[]).map((r) => [r.key, r.value]));
    const s = this.db.query('SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS b FROM sources WHERE project = ?').get(this.project) as { n: number; b: number };
    return { stored: c.stored ?? 0, returned: c.returned ?? 0, sources: s.n, sourceBytes: s.b };
  }

  /** Source ids in this project whose id or label is `ref`. */
  resolve(ref: string): string[] {
    return (this.db.query('SELECT id FROM sources WHERE project = ? AND (id = ? OR label = ?)').all(this.project, ref, ref) as { id: string }[]).map((r) => r.id);
  }

  search(query: string, limit: number, sources?: string[]): Hit[] {
    const q = ftsQuery(query);
    if (!q) return [];
    const cols = 'c.id, c.source_id AS sourceId, s.label, c.line_start AS lineStart, c.line_end AS lineEnd, c.heading, c.text';
    const scope = sources ? ` AND s.id IN (${sources.map(() => '?').join(',') || "''"})` : '';
    try {
      return this.db
        .query(`SELECT ${cols} FROM fts JOIN chunks c ON c.id = fts.rowid JOIN sources s ON s.id = c.source_id
          WHERE fts MATCH ? AND s.project = ?${scope} ORDER BY bm25(fts, 1.0, 2.0) LIMIT ?`)
        .all(q, this.project, ...(sources ?? []), limit) as Hit[];
    } catch (e) {
      process.stderr.write(`stash: FTS query failed (${(e as Error).message}), using LIKE\n`);
      const terms = q.split(' OR ').map((t) => `%${t.slice(1, -1)}%`);
      return this.db
        .query(`SELECT ${cols} FROM chunks c JOIN sources s ON s.id = c.source_id
          WHERE s.project = ?${scope} AND (${terms.map(() => 'c.text LIKE ?').join(' OR ')}) ORDER BY c.id DESC LIMIT ?`)
        .all(this.project, ...(sources ?? []), ...terms, limit) as Hit[];
    }
  }

  source(id: string): Source | null {
    return this.db.query('SELECT id, label, kind, bytes, content FROM sources WHERE id = ?').get(id) as Source | null;
  }

  /** A chunk (`c123`) or a whole source (`s…`), paged by character offset. */
  page(id: string, offset = 0, max = 12_000): { text: string; next: number | null; total: number } | null {
    const m = /^c(\d+)$/.exec(id);
    const full = m
      ? (this.db.query('SELECT text FROM chunks WHERE id = ?').get(Number(m[1])) as { text: string } | null)?.text
      : this.source(id)?.content;
    if (full == null) return null;
    const end = Math.min(full.length, offset + Math.max(1, max));
    return { text: full.slice(offset, end), next: end < full.length ? end : null, total: full.length };
  }

  prune(now = Date.now()) {
    const old = this.db.query('SELECT id FROM sources WHERE created < ?').all(now - WEEK_MS) as { id: string }[];
    this.db.transaction(() => {
      for (const { id } of old) {
        this.db.query('DELETE FROM fts WHERE rowid IN (SELECT id FROM chunks WHERE source_id = ?)').run(id);
        this.db.query('DELETE FROM chunks WHERE source_id = ?').run(id);
        this.db.query('DELETE FROM sources WHERE id = ?').run(id);
      }
    })();
    return old.length;
  }

  close() {
    this.db.close();
  }
}
