# claude-tuning

Personal Claude Code tuning, as a local plugin. Three hooks:

1. **Skill suggestions with Jev** (`UserPromptSubmit`). Before each turn, TypeSafe's Jev ranks every skill Claude can load and checks whether the request needs one. It then re-reads the top three with their `SKILL.md` openings and can reject all of them. If one fits, Claude gets one ignorable line: `Relevant to the current request: <skill>`. If none fits, Claude gets nothing. This follows [TypeSafe's skill-suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion), which halved wrong and needless skill loads on a 182-skill roster.
2. **Model routing with Jev** (`PreToolUse` on `Agent`). When Claude starts a subagent without choosing a model, Jev reads the task and switches it to Opus if it is complex coding (multi-file changes, architecture, hard bugs, performance). An explicit model is kept, read-only agent types (Explore) are skipped, and nothing is downgraded, so simple work stays on the Sonnet default. Adds about 0.8 s per agent launch.
3. **context-mode cap** (`SessionStart`). Claude Code passes at most 10,000 characters of hook output to the model. context-mode injected up to 27,000, so the model saw a 2 KB preview and most of its routing rules were lost. This patches context-mode's `sessionstart.mjs` to cut its session summary at a line break, keeping the rules. It re-applies itself after context-mode updates; the first session after an update runs unpatched.

## Install

```bash
claude plugin marketplace add D:\code\projects\claude-tuning
claude plugin install claude-tuning@claude-tuning
```

Then restart Claude Code. Needs Bun and `TYPESAFE_API_KEY`; without the key the suggester does nothing.

## Numbers (test/eval.ts, 14 prompts, 150 skills)

- 12 of 14 right: 7 of 8 skill requests, 5 of 6 requests that need no skill. The one wrong suggestion is ignorable; the one miss picked another docs skill.
- About 1.2–1.5 s added to each prompt of 12 characters or more. Slash commands and short replies ("go", "yes") skip it.
- Right picks scored 0.86 or more on "does this skill fit", needless ones 0.50–0.88, so the fit threshold is 0.6 (the cookbook uses 0.30).

Model routing (test/eval-route.ts): 14 of 14 right, with complex tasks scoring 0.84–0.97 and simple ones 0.01–0.09; 6 borderline tasks (a single-file flag, tests for one module, a dark-mode toggle, a flaky CI test, a 40-file migration) also landed as expected.

## Files

| File | Role |
|---|---|
| `src/suggest.ts` | The hook: two Jev requests, thresholds, output |
| `src/roster.ts` | Reads personal, project and enabled plugins' skills |
| `src/builtins.ts` | Skills Claude Code lists but that have no file on disk (built-ins, Anthropic's). Update when Claude Code adds skills. |
| `src/route-model.ts` | Model routing for subagents |
| `src/cap-context-mode.ts` | The context-mode patch |
| `test/eval.ts`, `test/eval-route.ts` | Live checks against Jev |

Debug: set `SKILL_SUGGEST_DEBUG=1` or `ROUTE_MODEL_DEBUG=1` to print decisions to stderr. Turn the whole thing off: `claude plugin disable claude-tuning@claude-tuning`.

Gate questions and suggestion wording are from TypeSafe's cookbook.
