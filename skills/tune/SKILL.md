---
name: tune
description: Set up this machine's Claude Code tuning in one go — installs Bun if missing, the pinned plugins, codebase-memory, the recommended settings and the CLAUDE.md tool rules, then reports what is left. Use when the user says "set up my Claude Code", "install the tuning", "run the setup", "check my setup", "what's out of date", or asks why a hook or plugin is not working.
---

# claude-tuning

The user ran this to have everything set up without doing anything themselves. Running `/claude-tuning:tune` is their consent, so do the whole setup now and don't ask first.

## Steps

1. **Bun.** Check with `bun --version`. If it is missing, install it with Bun's official installer, then use the full path it prints (a new PATH is not visible to this shell):
   - macOS / Linux: `curl -fsSL https://bun.sh/install | bash` → `~/.bun/bin/bun`
   - Windows: `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"` → `%USERPROFILE%\.bun\bin\bun.exe`
2. **Setup.** Run `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts --apply`. It installs the pinned plugins (stash, web-search, ponytail, i-have-adhd, fast-jev-compaction), installs rtk, codebase-memory, jev-browser and (macOS only) agent-desktop with their official installers if missing, adds the rtk hook, merges the settings and adds the tool rules to `~/.claude/CLAUDE.md`. Running it again changes nothing.
3. **Report** in a short table: what was installed or changed, what was already fine, what failed and why.
4. **API keys** are the only thing setup cannot do. If `JINA_API_KEY` (needed for web search, free at https://jina.ai/?sui=apikey) or `TYPESAFE_API_KEY` (optional, turns on Jev) is not set, say so, give the link, and show the one command that sets it for this OS. Never ask the user to paste a key into the chat.
5. If setup printed a note about Claude Code's version or a missing Node 22, pass it on with the one command that fixes it (`claude update`, or the Node installer link).
6. Tell the user to restart Claude Code: plugins and hooks load at startup.

## Other commands

| Need | Command |
|---|---|
| Preview without changing anything | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts` |
| Only some tools | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts --apply --only=rtk,stash` |
| Leave CLAUDE.md alone | add `--no-rules` |
| Upstream releases since our pins | `bun ${CLAUDE_PLUGIN_ROOT}/src/check-upstreams.ts` |

If the user's CLAUDE.md already states the tool rules in its own words, add `--no-rules` so they don't appear twice.

## Updating an upstream

1. `bun ${CLAUDE_PLUGIN_ROOT}/src/check-upstreams.ts` lists what moved.
2. Read that project's changelog before adopting it.
3. Edit the version (and `commit`) in `src/upstreams.ts`, run `bun test`, then `bun run setup --apply`.

Do not copy code from those projects into this repo; install them instead. `UPSTREAMS.md` records each licence.

## Our own parts

- **stash** (MCP server) keeps big outputs in a local index: `stash_run`, `stash_index`, then `stash_search` / `stash_get`.
