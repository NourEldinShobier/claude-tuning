## Token-saving tools (claude-tuning)

- Online research: use the `web-search` CLI via Bash (`search`, `news`, `papers`, `images`, `read <url> --focus "..."`), not WebSearch/WebFetch. Search first, read only the 1–3 results that matter, always with `--focus`.
- Shell commands are compressed by rtk's hook (git, tests, builds, listings…). When you need a command's raw, unfiltered output, run it as `rtk proxy <command>`. Run commands unpiped so rtk, not `head`, decides what to drop.
- Large outputs, logs, files you need only parts of: use the stash tools (`stash_run`, `stash_index`, then `stash_search` / `stash_get`) instead of reading raw bytes into context.
- Ponytail rules are injected each turn; follow them unless told "stop ponytail".
- If codebase-memory is installed: for code structure questions (where is X defined, what calls X), use `search_graph` / `trace_path` / `get_code_snippet` before Grep or Read, and index the repo first (`list_projects`, then `index_repository`). Confirm "who calls X" counts with `search_code`; the graph misses calls through indirect types.
- Multi-step browsing (click through a site, fill a search, reach a page behind navigation): use the jev-browser MCP tool when it is available; it returns the final page and a step trace. For reading one known URL, keep using `web-search read`.
- If Canny's hooks block a Stop: run the project's real check (tests, typecheck, lint) unpiped and fix what fails; don't argue with the gate.
- On macOS, if agent-desktop is installed: drive native apps through its accessibility refs (`agent-desktop snapshot`, then act on refs) rather than screenshots; its skill has the commands.
