# Upstreams

Everything this setup installs, and where it comes from. **No third-party code is copied into this repository**: each tool is installed from its own source, keeping its licence and its updates with its author.

Generated from `src/upstreams.ts` by `bun run upstreams:doc`. Check for newer releases with `bun run upstreams`.

| Tool | Source | Licence | Pinned | What it does | What claude-tuning changes |
|---|---|---|---|---|---|
| stash | [NourEldinShobier/stash](https://github.com/NourEldinShobier/stash) | MIT | 0.2.0 (`d136179`) | MCP server that keeps big outputs, files and pages in a local search index and returns only what Claude asks for, ranked by Jev. | Ours. Separate repo so it can be installed alone. |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT | 4.10.0 (`e3ba2aa`) | Pushes the agent to the simplest solution that works, and to reuse what the repo already has. | — |
| i-have-adhd | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT | 0.3.0 (`6f1f982`) | Answers lead with the next action, numbered steps, no preamble. Shorter output is also cheaper output. | — |
| fast-jev-compaction | [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | MIT | 0.3.0 (`e3f262a`) | Replaces Claude Code's summarising compaction: Jev picks which messages to keep, and kept messages stay word for word. Needs Claude Code 2.1.274+ and TYPESAFE_API_KEY; without them the built-in compaction runs. | Setup turns on function hooks (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1), which it needs. |
| quicksilver | [UditAkhourii/quicksilver](https://github.com/UditAkhourii/quicksilver) | MIT | 0.1.0 (`5d6fe5c`) | Skill that hands bulk judgment calls (which files matter, which log lines are failures, labels for many items, ranking) to Jev, so Claude reads only the shortlist. 86% fewer Claude tokens on its 12-task benchmark. Needs Node 18+ and TYPESAFE_API_KEY. | The tool rules tell Claude when to reach for it. |
| compact-adviser | [kunchenguid/compact-adviser](https://github.com/kunchenguid/compact-adviser) | MIT | 0.1.13 (`7dc0693`) | Jev judges when a finished piece of work makes a safe point to /compact, and compacts there instead of mid-task. Needs Claude Code 2.1.274+, Node 22+ and TYPESAFE_API_KEY. | Setup installs it in auto mode; run /compact-adviser auto once to confirm. Uses the function hooks setup already turns on. |
| jev-steer-or-queue | [Larkspur-Wang/Jev_steer_or_queue](https://github.com/Larkspur-Wang/Jev_steer_or_queue) | MIT | 0.2.0 (`3924e88`) | Jev decides whether a message sent mid-turn steers the running task, waits in a queue until the turn ends, or stops it. Needs python3 and TYPESAFE_API_KEY. | Installed in its default shadow mode (logs decisions only); set its mode to active in /plugin to queue and stop for real. |
| rtk | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) | Apache-2.0 | 0.49.0 | Compresses shell output (git, tests, builds, docker, kubectl, package managers and more) before it reaches the model. Up to 90% less output. | Setup installs it with its official installer and adds its Claude Code hook (rtk hook claude) for Bash and PowerShell. |
| codebase-memory | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | MIT | 0.11.0 | Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context. | The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search. |
| webclaw | [0xMassi/webclaw](https://github.com/0xMassi/webclaw) | AGPL-3.0 | 0.6.23 (`aadf8ed`) | Web search, scraping, crawling, sitemap mapping and multi-page extraction as clean markdown, over MCP. Replaces WebSearch/WebFetch. Search needs SERPER_API_KEY. | Setup downloads its official release binaries into ~/.local/bin and registers webclaw-mcp with Claude Code (user scope). An existing webclaw registration (Docker, a custom path) is kept. |

## Licences

- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.
- **AGPL-3.0** (webclaw): installed from its official release binaries, never copied or modified, so its terms do not reach this repository.
- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.

## Ours

stash is written by us, from scratch, and lives in its own repository so it can be installed alone. This bundle pins it like any other upstream.

Anything written in this repository is ours and MIT-licensed. Where an idea came from someone else, the file that implements it says so.
