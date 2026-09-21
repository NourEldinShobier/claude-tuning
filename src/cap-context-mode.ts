/**
 * SessionStart hook: keeps context-mode's session-start injection under Claude Code's 10,000-character
 * hook limit. Over it, Claude Code hands the model a 2 KB preview and a file path instead, so most of
 * context-mode's routing rules never arrive. This patches each installed context-mode version's
 * sessionstart.mjs once (marked, so it is idempotent and re-applied after plugin updates) to cut the
 * session guide at a line break. The routing rules come first and stay whole.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MARK = '// [claude-tuning: context-mode-cap]';
const ANCHOR = '  console.log(JSON.stringify({\n    hookSpecificOutput: {\n      hookEventName: "SessionStart",';
const PATCH = `  ${MARK} Claude Code passes at most 10,000 characters of hook context to the model.
  if (additionalContext.length > 9500) {
    const cut = additionalContext.lastIndexOf("\\n", 9300);
    additionalContext = additionalContext.slice(0, cut > 5000 ? cut : 9300) +
      "\\n\\n[Session guide cut to fit Claude Code's 10,000-character hook limit. Earlier decisions, files and errors: ctx_search(sort: \\"timeline\\").]";
  }
`;

/** Returns the patched source, or null when already patched or the anchor moved. */
export function patch(src: string): string | null {
  const s = src.replace(/\r\n/g, '\n');
  if (s.includes(MARK) || !s.includes(ANCHOR)) return null;
  return s.replace(ANCHOR, PATCH + ANCHOR);
}

if (import.meta.main) {
  try {
    const root = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'plugins', 'cache', 'context-mode', 'context-mode');
    for (const version of existsSync(root) ? readdirSync(root) : []) {
      const file = join(root, version, 'hooks', 'sessionstart.mjs');
      if (!existsSync(file)) continue;
      const next = patch(readFileSync(file, 'utf8'));
      if (next) writeFileSync(file, next);
    }
  } catch {
    // never block session start
  }
}
