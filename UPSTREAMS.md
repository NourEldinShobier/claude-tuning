# Upstreams

Everything this setup installs, and where it comes from. **No third-party code is copied into this repository**: each tool is installed from its own source, keeping its licence and its updates with its author.

Generated from `src/upstreams.ts` by `bun run upstreams:doc`. Check for newer releases with `bun run upstreams`.

| Tool | Source | Licence | Pinned | What it does | What claude-tuning changes |
|---|---|---|---|---|---|
| stash | [NourEldinShobier/stash](https://github.com/NourEldinShobier/stash) | MIT | 0.2.0 (`d136179`) | MCP server that keeps big outputs, files and pages in a local search index and returns only what Claude asks for, ranked by Jev. | Ours. Separate repo so it can be installed alone. |
| web-search | [NourEldinShobier/web-search](https://github.com/NourEldinShobier/web-search) | MIT | 0.6.3 (`299062a`) | Web, news, paper and image search plus page/PDF reading, trimmed for agents. Replaces WebSearch/WebFetch. | Ours. Separate repo so it is useful without this bundle. |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT | 4.10.0 (`e3ba2aa`) | Pushes the agent to the simplest solution that works, and to reuse what the repo already has. | Its per-subagent rules are turned off for the web-search researcher (PONYTAIL_SUBAGENT_MATCHER), which saves about 1.4k tokens per research agent. |
| i-have-adhd | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT | 0.3.0 (`6f1f982`) | Answers lead with the next action, numbered steps, no preamble. Shorter output is also cheaper output. | — |
| fast-jev-compaction | [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | MIT | 0.3.0 (`e3f262a`) | Replaces Claude Code's summarising compaction: Jev picks which messages to keep, and kept messages stay word for word. Needs Claude Code 2.1.274+ and TYPESAFE_API_KEY; without them the built-in compaction runs. | Setup turns on function hooks (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1), which it needs. |
| rtk | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) | Apache-2.0 | 0.49.0 | Compresses shell output (git, tests, builds, docker, kubectl, package managers and more) before it reaches the model. Up to 90% less output. | Setup installs it with its official installer and adds its Claude Code hook (rtk hook claude) for Bash and PowerShell. |
| codebase-memory | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | MIT | 0.11.0 | Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context. | The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search. |

## Licences

- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.
- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.

## Ours

stash and web-search are written by us, from scratch, and live in their own repositories so each can be installed alone. This bundle pins them like any other upstream.

Anything written in this repository is ours and MIT-licensed. Where an idea came from someone else, the file that implements it says so.
