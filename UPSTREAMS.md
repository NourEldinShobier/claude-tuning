# Upstreams

Everything this setup installs, and where it comes from. **No third-party code is copied into this repository**: each tool is installed from its own source, keeping its licence and its updates with its author.

Generated from `src/upstreams.ts` by `bun run upstreams:doc`. Check for newer releases with `bun run upstreams`.

| Tool | Source | Licence | Pinned | What it does | What claude-tuning changes |
|---|---|---|---|---|---|
| web-search | [NourEldinShobier/web-search](https://github.com/NourEldinShobier/web-search) | MIT | 0.6.1 | Web, news, paper and image search plus page/PDF reading, trimmed for agents. Replaces WebSearch/WebFetch. | Ours. Separate repo so it is useful without this bundle. |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT | 4.10.0 (`e3ba2aa`) | Pushes the agent to the simplest solution that works, and to reuse what the repo already has. | Its per-subagent rules are turned off for the web-search researcher (PONYTAIL_SUBAGENT_MATCHER), which saves about 1.4k tokens per research agent. |
| i-have-adhd | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT | 0.3.0 (`6f1f982`) | Answers lead with the next action, numbered steps, no preamble. Shorter output is also cheaper output. | — |
| context-mode | [mksglu/context-mode](https://github.com/mksglu/context-mode) | Elastic-2.0 | 1.0.169 (`6f0cc68`) | **Optional** (install with `--with=context-mode`): stash (src/stash/) provides the same sandbox-and-search workflow as an MCP server with no licence restrictions. Add context-mode for its session memory and wider tool set. Runs big commands, files and pages in a sandbox and returns only the derived answer, so raw bytes stay out of the context window. | Its session-start injection is capped to fit Claude Code's 10,000-character hook limit (src/cap-context-mode.ts); above that the model only receives a 2 KB preview and loses the routing rules. |
| context7 | [upstash/context7](https://github.com/upstash/context7) | MIT | 1.0.2 (`c324828`) | Current library and framework documentation, instead of the model answering from memory. | — |
| rtk | [rtk-ai/rtk](https://github.com/rtk-ai/rtk) | Apache-2.0 | 0.10.0 | **Optional** (install with `--with=rtk`): squeeze (src/squeeze/) filters Bash output after it runs; on our git log/diff benchmark it returns 2-5x less than rtk. Add rtk for its wider command coverage. Compresses shell output (git, tests, builds) before it reaches the model. Hooked on every Bash and PowerShell call. | — |
| codebase-memory | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | MIT | 0.11.0 | Code graph for structural questions (where is X defined, who calls X) without grepping whole files into context. | The setup writes the rule that the graph misses callers with indirect types, so counts are confirmed with a text search. |

## Licences

- **MIT** and **Apache 2.0**: may be copied with their notices. We still install rather than copy, so updates stay upstream.
- **Elastic 2.0** (context-mode): the source may be read and used, but not offered as a hosted service and not shipped with its licence controls removed. We install it unmodified and patch only our own copy at runtime.
- **None declared**: default copyright applies, so the code may not be copied or redistributed. Any such tool is installed from its own installer, exactly as its author publishes it.

## Our own replacements

- **squeeze** (`src/squeeze/`) shrinks Bash and PowerShell output after the command runs, with rules per command type (git, tests, installs, compiler errors, listings) and, for large unrecognised output, Jev picking the blocks relevant to the command's stated purpose. The full output is saved to a file named in the result. Written from observed command output, not from rtk's source.
- **stash** (`src/stash/`) is an MCP server that runs commands, code, files and URLs into a local SQLite FTS5 index and returns only a preview; `stash_search` (BM25, reranked by Jev) and `stash_get` pull what is needed. Written from a behaviour brief, not from context-mode's source.

Anything written in this repository is ours and MIT-licensed. Where an idea came from someone else, the file that implements it says so.
