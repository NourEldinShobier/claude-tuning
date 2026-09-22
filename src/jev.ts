/** Minimal TypeSafe Jev client (https://docs.typesafe.ai/api), shared by every hook here. */

export type Question =
  | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> };

export type Answer = { type: 'noul'; noul: number } | { type: 'choice'; choice: string; probabilities?: Record<string, number> };

export const jevKey = () => process.env.TYPESAFE_API_KEY;

export async function ask(state: unknown, questions: Record<string, Question>, signal: AbortSignal): Promise<Record<string, Answer | undefined>> {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jevKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal,
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`Jev HTTP ${res.status}`);
  }
  return ((await res.json()) as { answers?: Record<string, Answer> }).answers ?? {};
}

export const noul = (a: Answer | undefined, fallback = 0) => (a?.type === 'noul' ? a.noul : fallback);
