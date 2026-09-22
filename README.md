# claude-tuning

A token-efficient Claude Code setup in one command: a pinned set of plugins, the settings that make them work together, and our own hooks and MCP server that cut wasted tokens.

Works on macOS, Linux and Windows. Everything is TypeScript run by [Bun](https://bun.sh).

## Quick start

```bash
claude plugin marketplace add NourEldinShobier/claude-tuning
claude plugin install claude-tuning@claude-tuning
```

Restart Claude Code, then type **`/claude-tuning:tune`** (or ask "run the tuning setup"). Claude shows the plan first and changes nothing until you agree. It works the same in any shell on macOS, Linux and Windows.

Then restart Claude Code once more, so the new plugins and hooks load.

## What the setup does

1. **Installs the pinned plugins**, each from its own repository: web search, and the simplicity and answer-shape skills. See [UPSTREAMS.md](UPSTREAMS.md).
2. **Merges the recommended settings** into `~/.claude/settings.json`: a 700k auto-compact window, the `codebase-memory-mcp` hooks when it is installed, and the exemption that keeps the simplicity rules out of the web-search researcher (about 1.4k tokens per research agent). Existing values are kept and the old file is saved as `settings.json.bak`.
3. **Adds the tool rules to `~/.claude/CLAUDE.md`** ([rules.md](rules.md)), so Claude knows to use web-search, squeeze, stash and the code graph. They sit between `claude-tuning` markers: later runs replace only that block, and `--no-rules` skips it.
4. **Reports what is missing**: the code-graph tool and the two API keys, with the command for your platform. It never installs a binary for you and never prints a key.

`--only=web-search,ponytail` limits it to some tools. `--with=rtk,context-mode` adds the two optional upstreams that our own squeeze and stash replace. Running it twice changes nothing the second time.

## What this repository adds itself

Four hooks and one MCP server, all ours:

| Hook | What it does | Measured |
|---|---|---|
| **Skill suggestion** (`UserPromptSubmit`) | [TypeSafe's Jev](https://docs.typesafe.ai/cookbooks/skill_suggestion) ranks every skill Claude can load, re-reads the top three with their `SKILL.md` openings, and adds one ignorable line naming the best fit, or nothing. Matters because Claude Code caps its skill listing, so with a large roster many skills reach the model as a bare name. | 12 of 14 test prompts right; about 1.2–1.5 s per prompt; `bun test/eval.ts` |
| **Model routing** (`PreToolUse` on `Agent`) | When Claude starts a subagent without choosing a model, Jev decides whether the task is complex coding and switches it to Opus. Never downgrades, never overrides an explicit choice, skips read-only agents. | 14 of 14 test tasks right, plus 6 borderline; about 0.8 s per agent; `bun test/eval-route.ts` |
| **squeeze** (`PostToolUse` on `Bash`, `PowerShell`) | Shrinks command output after it runs, before Claude reads it: git status/log/diff, test runs (passing lines dropped), installs, compiler errors grouped by file, long listings, and head/tail plus error lines for everything else. For large output no rule understands, Jev keeps the 25-line blocks relevant to the command's stated purpose. The full output is saved to a file named in the result; `SQUEEZE=0` in a command skips it. | 79–93% fewer characters over seven real commands in two repos; 2–5x smaller than rtk on git log and diff; `bun bench/squeeze.ts <repo>` |
| **stash** (MCP server) | `stash_run`, `stash_code`, `stash_index` run commands, snippets, files or URLs into a local SQLite FTS5 index and return a preview; `stash_search` (BM25, reranked by Jev) and `stash_get` fetch only what is needed. | A 91 KB `git log -p` came back as 9.7 KB with the query's passages |
| **context-mode cap** (`SessionStart`) | Claude Code hands the model at most 10,000 characters of hook output; context-mode was sending up to 27,000, so the model got a 2 KB preview and lost its routing rules. This trims the session summary at a line break and keeps the rules. Re-applies itself after upstream updates. | — |

The Jev parts need `TYPESAFE_API_KEY`. Without it, suggestion and routing do nothing, squeeze uses its rules only, and stash ranks by BM25 alone.

## Upstreams, licences and updates

No third-party code is copied into this repository. Each tool is installed from its own source at a pinned version, so its licence and its updates stay with its author. squeeze and stash are clean-room rewrites of what rtk and context-mode do, written from their behaviour, never their source, so the default setup has no Elastic-licensed parts.

[UPSTREAMS.md](UPSTREAMS.md) lists each tool: source, licence, the version and commit we tested against, what it is for, and what we change about it.

See what has moved since those pins:

```bash
bun run upstreams
```

It prints the pinned and latest version for each, with a link. To adopt one: read its changelog, update the version (and commit) in `src/upstreams.ts`, run `bun test`, then `bun run setup --apply`. `UPSTREAMS.md` is generated from that file with `bun run upstreams:doc`, so the table can't drift from what the setup installs.

## Development

```bash
bun install
bun test          # unit tests, no network
bun run typecheck
bun test/eval.ts        # live check of skill suggestion (needs TYPESAFE_API_KEY)
bun test/eval-route.ts  # live check of model routing
bun bench/squeeze.ts ../some-repo  # raw vs rtk vs squeeze on real commands
```

Debug a session: `SKILL_SUGGEST_DEBUG=1`, `ROUTE_MODEL_DEBUG=1` or `SQUEEZE_DEBUG=1` prints each decision to stderr. `SQUEEZE=0` in the environment turns squeeze off. Turn everything off with `claude plugin disable claude-tuning@claude-tuning`.

## Credits

The skill-suggestion design, its gate questions and the wording of the suggestion come from [TypeSafe's skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion). The tools this setup installs are other people's work; [UPSTREAMS.md](UPSTREAMS.md) credits each one.

## Licence

[MIT](LICENSE) for everything in this repository.
