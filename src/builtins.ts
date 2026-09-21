/**
 * Skills Claude Code lists that have no SKILL.md on disk (built into the app, or Anthropic's own).
 * Without them, the nearest on-disk skill wins by default: "add a hook" drew `ctx-upgrade`.
 * Descriptions condensed from Claude Code's own skill listing. Update when Claude Code adds skills.
 */
import type { Skill } from './roster';

const B: [string, string][] = [
  ['update-config', 'Configure the Claude Code harness via settings.json: hooks for automated behaviours ("from now on when X", "whenever X", "before/after X"), permissions ("allow X"), env vars, hook troubleshooting.'],
  ['keybindings-help', 'Customize Claude Code keyboard shortcuts, rebind keys, chord bindings, ~/.claude/keybindings.json.'],
  ['code-review', 'Review the current diff, a PR, branch or path for correctness bugs; optionally comment on the PR or apply fixes.'],
  ['simplify', 'Review changed code for reuse, simplification and efficiency cleanups and apply them. Quality only, not bug hunting.'],
  ['security-review', 'Security review of the pending changes on the current branch.'],
  ['fewer-permission-prompts', 'Scan transcripts for common read-only tool calls and add an allowlist to reduce permission prompts.'],
  ['loop', 'Run a prompt or slash command on a recurring interval, or poll for status repeatedly.'],
  ['schedule', 'Create, update, list or run scheduled cloud agents (routines) on a cron schedule, or a one-time scheduled run.'],
  ['claude-api', 'Claude API / Anthropic SDK reference: model ids, pricing, streaming, tool use, MCP, agents, prompt caching, token counting, model migration.'],
  ['run', "Launch and drive this project's app to see a change working: run, start or screenshot it."],
  ['init', 'Create a CLAUDE.md file for this repository describing its structure and commands.'],
  ['dataviz', 'Create any chart, graph, plot, dashboard or data visualization, in any medium, with consistent accessible colors.'],
  ['artifact-design', 'Design guidance for publishing an HTML page as an Artifact.'],
  ['anthropic-skills:docx', 'Create, read or edit Word .docx documents.'],
  ['anthropic-skills:pdf', 'Read, create, fill, merge or split PDF files.'],
  ['anthropic-skills:pptx', 'Create, read or edit PowerPoint .pptx slide decks and presentations.'],
  ['anthropic-skills:xlsx', 'Create, read or edit Excel .xlsx spreadsheets, formulas and charts.'],
  ['anthropic-skills:skill-creator', 'Create a new skill, or improve and test an existing one.'],
  ['anthropic-skills:consolidate-memory', 'Review and tidy memory files: merge duplicates, fix stale facts, prune the index.'],
];

export const BUILTINS: Skill[] = B.map(([id, description]) => ({ id, description, body: '' }));
