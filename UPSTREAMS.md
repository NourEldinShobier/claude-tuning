# Upstreams

Everything this setup installs, and where it comes from. **No third-party code is copied into this repository**: each tool is installed from its own source, keeping its licence and its updates with its author.

Generated from `src/upstreams.ts` by `bun run upstreams:doc`. Check for newer releases with `bun run upstreams`.

| Tool | Source | Licence | Pinned | What it does | What claude-tuning changes |
|---|---|---|---|---|---|
| stash | [NourEldinShobier/stash](https://github.com/NourEldinShobier/stash) | MIT | 0.3.0 (`aebecb3`) | MCP server that keeps big outputs and files in a local search index and returns only what Claude asks for. Local only. | Separate repo so it can be installed alone. |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT | 5.3.3 (`7801d06`) | Pushes the agent to the simplest solution that works, and to reuse what the repo already has. | — |
| i-have-adhd | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT | 0.4.1 (`1ecea19`) | Answers lead with the next action, numbered steps, no preamble. Shorter output is also cheaper output. | — |
| smart-jev-compact | [NourEldinShobier/smart-jev-compact](https://github.com/NourEldinShobier/smart-jev-compact) | MIT | 0.4.0 (`b1bc4ad`) | One plugin for compaction: Jev picks which messages survive (kept ones stay word for word, dropped results can be saved to files), and the built-in adviser compacts at a finished checkpoint instead of mid-task. Quiet by default, with a no-API-key local mode. Needs Claude Code 2.1.274+, Node 22+ and TYPESAFE_API_KEY. | Our fork of tamaratran/fast-jev-compaction with kunchenguid/compact-adviser merged in; both upstreams are tracked in its UPSTREAM.lock.json. Setup installs it with the adviser in auto mode; run /compact-adviser auto once to confirm. Turns on the function hooks it needs. |
| quicksilver | [UditAkhourii/quicksilver](https://github.com/UditAkhourii/quicksilver) | MIT | 0.1.0 (`5d6fe5c`) | Skill that hands bulk judgment calls (which files matter, which log lines are failures, labels for many items, ranking) to Jev, so Claude reads only the shortlist. 86% fewer Claude tokens on its 12-task benchmark. Needs Node 18+ and TYPESAFE_API_KEY. | The tool rules tell Claude when to reach for it. |
| rtk | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) | Apache-2.0 | 1.1.0 (`753a3b0`) | Compresses shell output (git, tests, builds, docker, kubectl, package managers and more) before it reaches the model. Up to 90% less output. | Setup installs rtk-oss, the Apache-2.0 edition (hooks and every command filter; the full edition adds a BUSL-1.1 compression engine), with its official installer, and adds its Claude Code hook (rtk hook claude) for Bash and PowerShell. |
| codebase-memory | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | MIT | 0.12.1 (`a7158ac`) | Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context. | The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search. |
| toolgate | [NourEldinShobier/toolgate](https://github.com/NourEldinShobier/toolgate) | MIT | 0.17.1 (`d3fcd12`) | Jev checks each tool call before it runs. Configured here to stop only prompt injection: calls that follow instructions from a web page, file or tool output instead of the user's task. Needs TYPESAFE_API_KEY. | Fork of RiskAverseTech/toolgate (see its UPSTREAM.lock.json): built-in risk questions can be turned off, dist/ is committed so it installs from GitHub, and the doctor works on Windows. Setup installs the injection-only policy (when ~/.toolgate/toolgate.yaml is missing) and its Claude Code hooks. |

## Licences

- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.
- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.

## Companion repos and forks

stash is written from scratch for this bundle and lives in its own repository so it can be installed alone. This bundle pins it like any other upstream.

toolgate is installed from a fork. The fork keeps an `UPSTREAM.lock.json` naming the upstream commit it is synced with and what changed, so it can be updated from upstream later.

Everything written in this repository is MIT-licensed. Where an idea came from someone else, the file that implements it says so.
