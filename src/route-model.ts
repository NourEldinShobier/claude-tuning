/**
 * PreToolUse hook on Agent: picks Opus for complex coding subagents, with TypeSafe Jev.
 * Only fills a gap: an explicit `model` from Claude is kept (it sees the whole conversation, Jev only the
 * task text), nothing is ever downgraded, and Jev must be confident before it upgrades.
 * Without it, an unset model falls back to CLAUDE_CODE_SUBAGENT_MODEL (sonnet).
 */

/** Threshold tuned on test/eval-route.ts. */
const COMPLEX = 0.6;
const TIMEOUT_MS = 3_000;
/** Agent types that do their own model selection or only read. */
const SKIP_TYPES = new Set(['fork', 'Explore', 'claude-code-guide', 'statusline-setup']);

type Answer = { type: 'noul'; noul: number };

export interface AgentInput {
  prompt?: string;
  description?: string;
  subagent_type?: string;
  model?: string;
  [k: string]: unknown;
}

const QUESTIONS = {
  complex: {
    type: 'noul',
    instructions:
      'Does `task` ask the agent to write or change code in a way that needs deep reasoning: changes spread across several files, architecture or design decisions, a tricky algorithm, or finding the cause of a hard, unclear bug?',
    criteria: {
      true: 'Multi-file implementation or refactor, new architecture, concurrency or state bugs, performance work, security-sensitive changes, or a bug whose cause is not yet known',
      false: 'Searching, reading, summarizing, research, reviewing, answering a question, or a small well-specified edit to one place',
    },
  },
  mechanical: {
    type: 'noul',
    instructions:
      'Is `task` mainly searching, reading, gathering information, research, or a small mechanical edit whose exact change is already spelled out?',
  },
} as const;

/** Probability-weighted verdict: complex, and not merely mechanical. */
export function isComplex(complex: number, mechanical: number): boolean {
  return (complex + (1 - mechanical)) / 2 >= COMPLEX;
}

export async function judge(input: AgentInput, signal: AbortSignal): Promise<{ complex: number; mechanical: number }> {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: {
        task: { description: input.description ?? '', agent_type: input.subagent_type ?? 'general-purpose', instructions: (input.prompt ?? '').slice(0, 8000) },
      },
      questions: QUESTIONS,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  const answers = ((await res.json()) as { answers?: Record<string, Answer> }).answers ?? {};
  return { complex: answers.complex?.noul ?? 0, mechanical: answers.mechanical?.noul ?? 1 };
}

/** Whether this call is ours to decide at all. */
export function eligible(input: AgentInput): boolean {
  return !input.model && !SKIP_TYPES.has(input.subagent_type ?? '') && Boolean(input.prompt);
}

if (import.meta.main) {
  try {
    const event = JSON.parse((await Bun.stdin.text()) || '{}') as { tool_input?: AgentInput };
    const input = event.tool_input ?? {};
    if (process.env.TYPESAFE_API_KEY && eligible(input)) {
      const s = await judge(input, AbortSignal.timeout(TIMEOUT_MS));
      if (process.env.ROUTE_MODEL_DEBUG) process.stderr.write(`route-model: complex ${s.complex.toFixed(2)} mechanical ${s.mechanical.toFixed(2)}\n`);
      if (isComplex(s.complex, s.mechanical)) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'allow',
              permissionDecisionReason: `Jev: complex coding task, running on Opus (${s.complex.toFixed(2)})`,
              updatedInput: { ...input, model: 'opus' },
            },
          })
        );
      }
    }
  } catch (e) {
    // Never block an agent launch: on any failure, leave the call as it is.
    if (process.env.ROUTE_MODEL_DEBUG) process.stderr.write(`route-model failed: ${(e as Error).message}\n`);
  }
}
