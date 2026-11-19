import { explainTemplate, type ExplainInput, type Explanation } from './explain';

// Provider-agnostic wrapper: any OpenAI-compatible chat-completions endpoint.
// Env: LLM_API_KEY (or OPENAI_API_KEY), LLM_BASE_URL, LLM_MODEL.
// The key is never logged or returned to the client.
const SYSTEM_PROMPT = `You explain a mental-health screening result in plain, kind language.
Strict rules you must never break:
- You do NOT diagnose, name conditions, or give medical advice.
- You do NOT recommend medication or specific treatments.
- You do NOT decide crisis situations or tell the user whether they are in crisis.
- You do NOT score, match support options, or make any decision — all of that is done by deterministic code elsewhere.
- Always make clear this is a screening, not a diagnosis.
- Be short (under 90 words), warm, and non-judgmental.
- Reply ONLY in the requested language, with no preamble.`;

const LANGUAGE_NAME = { en: 'English', ar: 'Arabic', hi: 'Hindi' } as const;

export async function llmExplanation(input: ExplainInput): Promise<string | null> {
  const key = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 220,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Reply in ${LANGUAGE_NAME[input.language]}. The person completed the ${input.instrument === 'PHQ9' ? 'PHQ-9 mood' : 'GAD-7 anxiety'} screening. Deterministic code scored it ${input.total} points, band "${input.band}". Explain gently what this band generally means and that it is a screening, not a diagnosis. Do not add any decision or advice beyond suggesting they follow the support steps already shown to them.`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return typeof text === 'string' && text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Crisis explanations are ALWAYS the fixed template — never an LLM.
export async function explainResult(input: ExplainInput): Promise<Explanation> {
  if (input.band === 'crisis') {
    return { text: explainTemplate(input), source: 'template' };
  }
  const text = await llmExplanation(input);
  if (text) return { text, source: 'llm' };
  return { text: explainTemplate(input), source: 'template' };
}