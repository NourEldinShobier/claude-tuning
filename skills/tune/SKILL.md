---
name: tune
description: Set up or check this machine's Claude Code tuning — install the pinned plugins, merge the recommended settings, report missing tools and keys, and show which upstreams have new releases. Use when the user says "set up my Claude Code", "install the tuning", "run the setup", "check my setup", "what's out of date", or asks why a hook or plugin is not working.
---

# claude-tuning

Run these through Bash. Everything prints a plan first and changes nothing without `--apply`.

| Need | Command |
|---|---|
| Show what setup would do | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts` |
| Do it | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts --apply` |
| One tool only | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts --apply --only=web-search,ponytail` |
| Add the optional upstreams | `bun ${CLAUDE_PLUGIN_ROOT}/src/setup.ts --apply --with=rtk,context-mode` |
| Upstream releases since our pins | `bun ${CLAUDE_PLUGIN_ROOT}/src/check-upstreams.ts` |

After `--apply`, tell the user to restart Claude Code: hooks and plugins load at startup.

## What it changes

- Installs the plugins listed in `src/upstreams.ts`, each from its own repository at a pinned version.
- Merges the settings in `src/settings.ts` into `~/.claude/settings.json`: subagent cap and default model, the ponytail exemption for the web-search researcher, the auto-compact window, and the codebase-memory-mcp hooks when it is installed (plus rtk's hook with `--with=rtk`). Existing values are kept and the old file is saved as `settings.json.bak`.
- Never installs binaries: it prints the command for this platform and lets the user run it.

## Updating an upstream

1. `bun ${CLAUDE_PLUGIN_ROOT}/src/check-upstreams.ts` lists what moved.
2. Read that project's changelog before adopting it.
3. Edit the version (and `commit`) in `src/upstreams.ts`, run `bun test`, then `bun run setup --apply`.

Do not copy code from those projects into this repo; install them instead. `UPSTREAMS.md` records each licence.

## Our own parts

- **squeeze** (PostToolUse on Bash/PowerShell) shrinks long output and names the file holding the full text. If something was cut, Read that file, or rerun the command with `SQUEEZE=0` in it.
- **stash** (MCP server) keeps big outputs in a local index: `stash_run`, `stash_index`, then `stash_search` / `stash_get`.
