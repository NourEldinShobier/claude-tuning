# claude-tuning

A token-efficient Claude Code setup in one command: a pinned set of plugins, the settings that make them work together, and three of our own hooks that cut wasted tokens.

Works on macOS, Linux and Windows. Everything is TypeScript run by [Bun](https://bun.sh).

## Quick start

```bash
claude plugin marketplace add NourEldinShobier/claude-tuning
claude plugin install claude-tuning@claude-tuning
```

Restart Claude Code, then run the setup (it prints a plan and changes nothing until you say so):

```bash
bun ~/.claude/plugins/cache/claude-tuning/claude-tuning/*/src/setup.ts
bun ~/.claude/plugins/cache/claude-tuning/claude-tuning/*/src/setup.ts --apply
```

Or just ask Claude: **"run the tuning setup"**. The bundled `tune` skill does the same thing.

Then restart Claude Code once more, so the new plugins and hooks load.

## What the setup does

1. **Installs the pinned plugins**, each from its own repository: web search, the simplicity and answer-shape skills, the context sandbox, and the documentation lookup. See [UPSTREAMS.md](UPSTREAMS.md).
2. **Merges the recommended settings** into `~/.claude/settings.json`: at most 5 parallel subagents, Sonnet as the subagent default, a 700k auto-compact window, the hooks for `rtk` and `codebase-memory-mcp` when those are installed, and the exemption that keeps the simplicity rules out of the web-search researcher (about 1.4k tokens per research agent). Existing values are kept and the old file is saved as `settings.json.bak`.
3. **Reports what is missing**: the two command-line tools and the two API keys, with the command for your platform. It never installs a binary for you and never prints a key.

`--only=web-search,ponytail` limits it to some tools. Running it twice changes nothing the second time.

## What this repository adds itself

Three hooks, all ours, all optional:

| Hook | What it does | Measured |
|---|---|---|
| **Skill suggestion** (`UserPromptSubmit`) | [TypeSafe's Jev](https://docs.typesafe.ai/cookbooks/skill_suggestion) ranks every skill Claude can load, re-reads the top three with their `SKILL.md` openings, and adds one ignorable line naming the best fit, or nothing. Matters because Claude Code caps its skill listing, so with a large roster many skills reach the model as a bare name. | 12 of 14 test prompts right; about 1.2–1.5 s per prompt; `bun test/eval.ts` |
| **Model routing** (`PreToolUse` on `Agent`) | When Claude starts a subagent without choosing a model, Jev decides whether the task is complex coding and switches it to Opus. Never downgrades, never overrides an explicit choice, skips read-only agents. | 14 of 14 test tasks right, plus 6 borderline; about 0.8 s per agent; `bun test/eval-route.ts` |
| **context-mode cap** (`SessionStart`) | Claude Code hands the model at most 10,000 characters of hook output; context-mode was sending up to 27,000, so the model got a 2 KB preview and lost its routing rules. This trims the session summary at a line break and keeps the rules. Re-applies itself after upstream updates. | — |

The Jev hooks need `TYPESAFE_API_KEY`. Without it they do nothing and everything else still works.

## Upstreams, licences and updates

No third-party code is copied into this repository. Each tool is installed from its own source at a pinned version, so its licence and its updates stay with its author. Three of them publish no licence at all, and one is Elastic 2.0, which is exactly why this repository installs rather than vendors.

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
```

Debug a session: `SKILL_SUGGEST_DEBUG=1` or `ROUTE_MODEL_DEBUG=1` prints each decision to stderr. Turn everything off with `claude plugin disable claude-tuning@claude-tuning`.

## Credits

The skill-suggestion design, its gate questions and the wording of the suggestion come from [TypeSafe's skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion). The tools this setup installs are other people's work; [UPSTREAMS.md](UPSTREAMS.md) credits each one.

## Licence

[MIT](LICENSE) for everything in this repository.
