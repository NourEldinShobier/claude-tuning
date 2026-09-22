## Token-saving tools (claude-tuning)

- Online research: use the `web-search` CLI via Bash (`search`, `news`, `papers`, `images`, `read <url> --focus "..."`), not WebSearch/WebFetch. Search first, read only the 1–3 results that matter, always with `--focus`.
- Shell output over ~2.5k chars is shrunk by the squeeze hook, which names a file holding the full text. Read that file (or rerun with `SQUEEZE=0` in the command) when something you need was cut. Run commands unpiped so squeeze, not `head`, decides what to drop.
- Large outputs, logs, files you need only parts of: use the stash tools (`stash_run`, `stash_index`, then `stash_search` / `stash_get`) instead of reading raw bytes into context.
- Ponytail rules are injected each turn; follow them unless told "stop ponytail".
- If codebase-memory is installed: for code structure questions (where is X defined, what calls X), use `search_graph` / `trace_path` / `get_code_snippet` before Grep or Read, and index the repo first (`list_projects`, then `index_repository`). Confirm "who calls X" counts with `search_code`; the graph misses calls through indirect types.
