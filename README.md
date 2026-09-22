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
3. Type `/claude-tuning:tune`. Claude shows a plan and changes nothing until you say yes.
4. Restart Claude Code once more.

Done.

## You need

| What | Required? | Get it |
|---|---|---|
| [Bun](https://bun.sh) | Yes | `curl -fsSL https://bun.sh/install \| bash` (Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"`) |
| `JINA_API_KEY` | Yes, for web search | Free at [jina.ai](https://jina.ai/?sui=apikey) |
| `TYPESAFE_API_KEY` | Optional | Turns on the Jev features below. [typesafe.ai](https://typesafe.ai) |

## What you get

**Works right after install:**

| Part | What it does | Result |
|---|---|---|
| **squeeze** | Shrinks long command output before Claude reads it. The full text is saved to a file, so nothing is lost. | 79–93% smaller output on real commands |
| **stash** | Keeps big outputs, files and pages in a local search index. Claude pulls back only the parts it needs. | 91 KB of git history came back as 9.7 KB |
| **Skill suggestions** (Jev) | Tells Claude which of its skills fits your request. | 12 of 14 test prompts right |
| **Model routing** (Jev) | Moves hard coding subagent tasks to Opus. Never downgrades, never overrides a model Claude chose. | 14 of 14 test tasks right |

**Added by `/claude-tuning:tune`:**

| Part | What it does |
|---|---|
| [web-search](https://github.com/NourEldinShobier/web-search) | Web research in a fraction of the tokens |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Keeps code minimal |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Short answers that lead with the next action |
| Tool rules in `~/.claude/CLAUDE.md` | Tell Claude when to use the tools above |
| Settings | 700k auto-compact window; code-graph hooks if you have [codebase-memory](https://github.com/DeusData/codebase-memory-mcp) |

Your existing settings are kept. Backups: `settings.json.bak`, `CLAUDE.md.bak`.

## Without a TypeSafe key

Everything still works:

- Skill suggestions and model routing turn off.
- squeeze uses its rules only.
- stash ranks results without Jev.

## Setup options

| Flag | Does |
|---|---|
| `--only=web-search,ponytail` | Installs only these |
| `--no-rules` | Leaves your CLAUDE.md alone |

Running setup twice is safe. The second run changes nothing.

## Turn things off

| To turn off | Do this |
|---|---|
| squeeze for one command | Put `SQUEEZE=0` in the command |
| squeeze everywhere | Set the environment variable `SQUEEZE=0` |
| All of it | `claude plugin disable claude-tuning@claude-tuning` |

## Tools we use

We copy no third-party code. Each tool installs from its own repo at a pinned version.

| Tool | What it does | Reported gain | Licence | How we use it |
|---|---|---|---|---|
| **squeeze** (ours) | Shrinks long shell output before Claude reads it. The full text is saved to a file. | 79–93% smaller output on real commands. On git log and diff it returned 1.6–3.6x less than [rtk](https://github.com/rtk-ai/rtk). | MIT | Built in |
| **stash** (ours) | Keeps big outputs, files and pages in a local search index. Claude pulls back only what it needs, ranked by Jev. | 91 KB of git history came back as 9.7 KB (89% less) | MIT | Built in |
| [web-search](https://github.com/NourEldinShobier/web-search) | Web search and page reading as compact markdown | ~24x fewer tokens and ~3.5x faster than calling Jina directly | MIT | Installed by setup |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Makes Claude write the smallest code that works | 54% less code, 22% fewer tokens, 20% cheaper, 27% faster | MIT | Installed by setup |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | Answers lead with the next action: numbered steps, no filler | No published numbers; shorter answers | MIT | Installed by setup |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Code graph: "where is X defined, who calls X" without reading whole files | 120x fewer tokens (3.4k vs 412k over 5 queries) | MIT | You install it; setup adds its hooks |

Gains for squeeze, stash and web-search are our own measurements. squeeze vs rtk: six git commands in two repos, rtk 0.10.0, run 2026-09-22. rtk came out smaller on one `bun test` run, where it printed only a short summary. Gains for the other tools come from their own READMEs and benchmarks. They measure different things, so the numbers don't add up to one total. Pinned versions are in [UPSTREAMS.md](UPSTREAMS.md).

**Services:**

| Service | Used by |
|---|---|
| [TypeSafe Jev](https://typesafe.ai) | Skill suggestions, model routing, squeeze, stash ranking, web-search planning |
| [Jina](https://jina.ai) | web-search (search, page reading, reranking) and stash URL loading |

**Runtime:** [Bun](https://bun.sh) runs everything. Only Bun's built-ins are used: SQLite, fetch and spawn.

More detail, including pinned commits and what we change in each tool: [UPSTREAMS.md](UPSTREAMS.md).

- squeeze and stash are our own code, written from scratch.
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
bun bench/squeeze.ts ../some-repo   # raw vs squeeze on real commands
```

Debug output: set `SKILL_SUGGEST_DEBUG=1`, `ROUTE_MODEL_DEBUG=1` or `SQUEEZE_DEBUG=1`.

## Credits

- Skill suggestions follow [TypeSafe's skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion).
- Every installed tool is credited in [UPSTREAMS.md](UPSTREAMS.md).

## Licence

[MIT](LICENSE)
