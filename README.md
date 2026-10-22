# claude-tuning

**Claude Code uses fewer tokens and answers faster. One install, about 5 minutes.**

Works on macOS, Linux and Windows.

## Install (5 minutes)

1. Run these two commands:

   ```bash
   claude plugin marketplace add NourEldinShobier/claude-tuning
   claude plugin install claude-tuning@claude-tuning
   ```

2. Restart Claude Code.
3. Type `/claude-tuning:tune`. Claude installs and configures everything that is missing: Bun, the plugins, rtk, codebase-memory, settings and rules.
4. Restart Claude Code once more.

Done.

## You need

Setting the API keys is the only step you do yourself.

| What | Required? | Get it |
|---|---|---|
| [Bun](https://bun.sh) | Yes | Installed by `/claude-tuning:tune` if missing |
| Claude Code 2.1.274+ | For fast-jev-compaction | `claude update` |
| `JINA_API_KEY` | Optional | stash uses it to load URLs. Free at [jina.ai](https://jina.ai/?sui=apikey) |
| `TYPESAFE_API_KEY` | Optional | Turns on the Jev features below. [console.typesafe.ai](https://console.typesafe.ai/settings/keys) |

## What you get

**Works right after install:**

| Part | What it does | Result |
|---|---|---|
| **Skill suggestions** (Jev) | Tells Claude which of its skills fits your request. | 14 of 17 test prompts right |
| **Model routing** (Jev) | Moves hard coding subagent tasks to Opus. Never downgrades, never overrides a model Claude chose. | 14 of 14 test tasks right |

**Added by `/claude-tuning:tune`:**

| Part | What it does |
|---|---|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output before Claude reads it: up to 90% less. Installed with its official installer if missing |
| [stash](https://github.com/NourEldinShobier/stash) | Keeps big outputs in a local search index; Claude pulls back only what it needs |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Keeps code minimal |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Short answers that lead with the next action |
| Tool rules in `~/.claude/CLAUDE.md` | Tell Claude when to use the tools above |
| [codebase-memory](https://github.com/DeusData/codebase-memory-mcp) | Code graph; installed with its official installer if missing |
| [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) (Jev) | Compaction that keeps chosen messages word for word instead of summarising them |
| [quicksilver](https://github.com/UditAkhourii/quicksilver) (Jev) | Jev picks the files, log lines or items that matter, so Claude reads only those |
| [compact-adviser](https://github.com/kunchenguid/compact-adviser) (Jev) | Compacts on its own at a finished checkpoint, not mid-task. Confirm once with `/compact-adviser auto` |
| [jev-steer-or-queue](https://github.com/NourEldinShobier/Jev_steer_or_queue) (Jev) | Decides whether a message you send mid-turn steers, queues or stops the task |
| [toolgate](https://github.com/NourEldinShobier/toolgate) (Jev) | Stops tool calls that follow prompt-injected instructions; everything else runs |
| Settings | 700k auto-compact window, function hooks on (for compaction), the code-graph and rtk hooks, and auto-update for claude-tuning and stash |

Your existing settings are kept. Backups: `settings.json.bak`, `CLAUDE.md.bak`.

## Without a TypeSafe key

Everything still works:

- Skill suggestions and model routing turn off.
- Compaction falls back to Claude Code's own; compact-adviser, jev-steer-or-queue and quicksilver stay idle.
- stash ranks results without Jev.

## Setup options

| Flag | Does |
|---|---|
| `--only=rtk,stash` | Installs only these |
| `--no-rules` | Leaves your CLAUDE.md alone |

Running setup twice is safe. The second run changes nothing.

## Turn things off

| To turn off | Do this |
|---|---|
| rtk for one command | Run it as `rtk bypass <command>` |
| One part | `claude plugin disable stash@stash` (or `ponytail@ponytail`, …); toolgate: delete the hooks whose command contains `toolgate` from `~/.claude/settings.json`, then `npm uninstall -g @riskaverse/toolgate` |
| All of it | `claude plugin disable claude-tuning@claude-tuning` |

## Tools we use

We copy no third-party code. Each tool installs from its own repo at a pinned version.

| Tool | What it does | Reported gain | Licence | How we use it |
|---|---|---|---|---|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output: git, tests, builds, docker, kubectl, package managers and more | Up to 90% less output | Apache-2.0 | Installed by setup if missing, with its hook |
| [stash](https://github.com/NourEldinShobier/stash) | Keeps big outputs, files and pages in a local search index. Claude pulls back only what it needs, ranked by Jev. | 91 KB of git history came back as 9.7 KB (89% less) | MIT | Installed by setup; install alone: `stash@stash` |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Makes Claude write the smallest code that works | 54% less code, 22% fewer tokens, 20% cheaper, 27% faster | MIT | Installed by setup |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Answers lead with the next action: numbered steps, no filler | No published numbers; shorter answers | MIT | Installed by setup |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Code graph: "where is X defined, who calls X" without reading whole files | 120x fewer tokens (3.4k vs 412k over 5 queries) | MIT | Installed by setup if missing |
| [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | Jev picks which messages survive compaction; kept ones stay verbatim | No published token numbers; no summary drift | MIT | Installed by setup; function hooks turned on |
| [quicksilver](https://github.com/UditAkhourii/quicksilver) | Jev filters, labels and ranks many files, log lines or items, so Claude reads only the matches | 86% fewer Claude tokens on 12 tasks, up to 20x faster | MIT | Installed by setup; the tool rules say when to use it |
| [compact-adviser](https://github.com/kunchenguid/compact-adviser) | Jev picks a finished checkpoint and runs /compact there | No published token numbers; avoids compacting mid-task | MIT | Installed by setup in auto mode |
| [jev-steer-or-queue](https://github.com/NourEldinShobier/Jev_steer_or_queue) | Jev routes mid-turn messages: steer, queue until the turn ends, or stop | No token numbers; 450–650 ms per mid-turn message, ~90 ms per tool hook (Rust port in the fork) | MIT | Fork; installed by setup in shadow mode |
| [toolgate](https://github.com/NourEldinShobier/toolgate) | Jev checks each tool call before it runs; here only for prompt injection | ~0.4 s per gated call | MIT | Fork; installed by setup with the injection-only policy |

Gains for stash were measured in this repo. Gains for the other tools come from their own READMEs and benchmarks. They measure different things, so the numbers don't add up to one total. Pinned versions are in [UPSTREAMS.md](UPSTREAMS.md).

**Services:**

| Service | Used by |
|---|---|
| [TypeSafe Jev](https://typesafe.ai) | Skill suggestions, model routing, compaction, stash ranking, quicksilver, toolgate |
| [Jina](https://jina.ai) | stash URL loading |

**Runtime:** [Bun](https://bun.sh) runs this code. Only Bun's built-ins are used: SQLite, fetch and spawn.

More detail, including pinned commits and what changes in each tool: [UPSTREAMS.md](UPSTREAMS.md).

- stash is written from scratch for this bundle. It lives in its own repo, so you can install it without this bundle.
- `bun run upstreams` shows which tools have newer releases.

To update one:

1. Read its changelog.
2. Change the version in `src/upstreams.ts`.
3. Run `bun test`.

## Develop

```bash
bun install
bun test                 # unit tests, no network
bun run typecheck
bun test/eval.ts         # live skill-suggestion check (needs TYPESAFE_API_KEY)
bun test/eval-route.ts   # live model-routing check
```

Debug output: set `SKILL_SUGGEST_DEBUG=1` or `ROUTE_MODEL_DEBUG=1`.

## Credits

- Skill suggestions follow [TypeSafe's skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion).
- Every installed tool is credited in [UPSTREAMS.md](UPSTREAMS.md).

## Licence

[MIT](LICENSE)
