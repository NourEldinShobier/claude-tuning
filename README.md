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
3. Type `/claude-tuning:tune`. Claude installs and configures everything that is missing: Bun, the plugins, rtk, codebase-memory, jev-browser, Canny, settings and rules.
4. Restart Claude Code once more.

Done.

## You need

Setting the API keys is the only step you do yourself.

| What | Required? | Get it |
|---|---|---|
| [Bun](https://bun.sh) | Yes | Installed by `/claude-tuning:tune` if missing |
| [Node.js](https://nodejs.org) 22+ | For jev-browser and Canny | Skipped with a note if missing |
| Claude Code 2.1.274+ | For fast-jev-compaction | `claude update` |
| `JINA_API_KEY` | Yes, for web search | Free at [jina.ai](https://jina.ai/?sui=apikey) |
| `TYPESAFE_API_KEY` | Optional | Turns on the Jev features below. [console.typesafe.ai](https://console.typesafe.ai/settings/keys) |

## What you get

**Works right after install:**

| Part | What it does | Result |
|---|---|---|
| **Skill suggestions** (Jev) | Tells Claude which of its skills fits your request. | 12 of 14 test prompts right |
| **Model routing** (Jev) | Moves hard coding subagent tasks to Opus. Never downgrades, never overrides a model Claude chose. | 14 of 14 test tasks right |

**Added by `/claude-tuning:tune`:**

| Part | What it does |
|---|---|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output before Claude reads it: up to 90% less. Installed with its official installer if missing |
| [stash](https://github.com/NourEldinShobier/stash) (ours) | Keeps big outputs in a local search index; Claude pulls back only what it needs |
| [web-search](https://github.com/NourEldinShobier/web-search) (ours) | Web research in a fraction of the tokens |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Keeps code minimal |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Short answers that lead with the next action |
| Tool rules in `~/.claude/CLAUDE.md` | Tell Claude when to use the tools above |
| [codebase-memory](https://github.com/DeusData/codebase-memory-mcp) | Code graph; installed with its official installer if missing |
| [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) (Jev) | Compaction that keeps chosen messages word for word instead of summarising them |
| [jev-browser](https://github.com/jkudish/jev-browser) (Jev) | MCP server for multi-step browser tasks, with Jev picking each click |
| [Canny](https://github.com/qkal/canny) | Blocks "done" until tests or another real check passed after the last edit |
| [agent-desktop](https://github.com/lahfir/agent-desktop) | macOS only: drives native apps through the accessibility tree, plus its skills |
| Settings | 700k auto-compact window, function hooks on (for compaction), the code-graph and rtk hooks, and auto-update for claude-tuning, stash and web-search |

Your existing settings are kept. Backups: `settings.json.bak`, `CLAUDE.md.bak`.

## Without a TypeSafe key

Everything still works:

- Skill suggestions and model routing turn off.
- Compaction falls back to Claude Code's own.
- jev-browser reports the missing key when called.
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
| rtk for one command | Run it as `rtk proxy <command>` |
| Canny | `node ~/.canny/src/dist/cli.js remove --global` |
| jev-browser | `claude mcp remove -s user jev-browser` |
| One part | `claude plugin disable stash@stash` (or `web-search@web-search`, …) |
| All of it | `claude plugin disable claude-tuning@claude-tuning` |

## Tools we use

We copy no third-party code. Each tool installs from its own repo at a pinned version.

| Tool | What it does | Reported gain | Licence | How we use it |
|---|---|---|---|---|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output: git, tests, builds, docker, kubectl, package managers and more | Up to 90% less output | Apache-2.0 | Installed by setup if missing, with its hook |
| [stash](https://github.com/NourEldinShobier/stash) (ours) | Keeps big outputs, files and pages in a local search index. Claude pulls back only what it needs, ranked by Jev. | 91 KB of git history came back as 9.7 KB (89% less) | MIT | Installed by setup; install alone: `stash@stash` |
| [web-search](https://github.com/NourEldinShobier/web-search) (ours) | Web search and page reading as compact markdown | ~24x fewer tokens and ~3.5x faster than calling Jina directly | MIT | Installed by setup |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Makes Claude write the smallest code that works | 54% less code, 22% fewer tokens, 20% cheaper, 27% faster | MIT | Installed by setup |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Answers lead with the next action: numbered steps, no filler | No published numbers; shorter answers | MIT | Installed by setup |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Code graph: "where is X defined, who calls X" without reading whole files | 120x fewer tokens (3.4k vs 412k over 5 queries) | MIT | Installed by setup if missing |
| [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | Jev picks which messages survive compaction; kept ones stay verbatim | No published token numbers; no summary drift | MIT | Installed by setup; function hooks turned on |
| [jev-browser](https://github.com/jkudish/jev-browser) | Headless Chromium driven by Jev, one action per step; returns the final page and a step trace | Fractions of a cent per run (our test: 4 Jev calls, 6.9 s, $0.0004) | MIT | MCP server registered by setup |
| [Canny](https://github.com/qkal/canny) | Hooks that keep an evidence ledger and block "done" until a real check passed | Its 25-pair Opus run: same pass rate and cost, no measurable overhead | MIT | Cloned and `init --global` run by setup |
| [agent-desktop](https://github.com/lahfir/agent-desktop) | Native macOS app control through accessibility refs instead of screenshots | No published token numbers | Apache-2.0 | macOS only: npm install plus its skills |

Gains for stash and web-search are our own measurements. Gains for the other tools come from their own READMEs and benchmarks. They measure different things, so the numbers don't add up to one total. Pinned versions are in [UPSTREAMS.md](UPSTREAMS.md).

**Services:**

| Service | Used by |
|---|---|
| [TypeSafe Jev](https://typesafe.ai) | Skill suggestions, model routing, compaction, jev-browser, Canny rule checks, stash ranking, web-search planning |
| [Jina](https://jina.ai) | web-search (search, page reading, reranking) and stash URL loading |

**Runtime:** [Bun](https://bun.sh) runs everything. Only Bun's built-ins are used: SQLite, fetch and spawn.

More detail, including pinned commits and what we change in each tool: [UPSTREAMS.md](UPSTREAMS.md).

- stash and web-search are ours, written from scratch. Each lives in its own repo, so you can install any of them without this bundle.
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
