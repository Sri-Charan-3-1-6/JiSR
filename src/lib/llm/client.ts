import { explainTemplate, type ExplainInput, type Explanation, type Instrument, type Language } from '../explain';
import {
  BREAKER_COOLDOWN_MS,
  BREAKER_THRESHOLD,
  MAX_GROUPS,
  MAX_MODELS_PER_REQUEST,
  REQUEST_TIMEOUT_MS,
  type Provider,
  getProviders,
} from './config';
import { getFreeModels } from './models';
import { validateExplanation } from './validate';

const SYSTEM_PROMPT = `You explain a mental-health screening result in plain, kind language.
Strict rules you must never break:
- You do NOT diagnose, name conditions or disorders, or give medical advice.
- Never say "you have", "you are suffering from", "you are depressed", "you are anxious", or "diagnosed with". Never name any disorder.
- Never mention medications, doses, or starting, stopping or changing any treatment.
- You do NOT decide crisis situations or tell the user whether they are in crisis.
- You do NOT score, match support options, or make any decision — all of that is done by deterministic code elsewhere.
- Always say this is a screening, not a diagnosis.
- Say what the result generally means AND what it does not mean.
- Always say a health professional should confirm what the result means for the person.
- Be short (under 90 words), warm, and non-judgmental.
- Reply ONLY in the requested language, with no preamble.`;

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  PHQ9: 'PHQ-9 mood questionnaire',
  GAD7: 'GAD-7 anxiety questionnaire',
};
const LANGUAGE_NAME: Record<Language, string> = { en: 'English', ar: 'Arabic', hi: 'Hindi' };
const BANDS = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];

// PRIVACY WHITELIST: only instrument, band and language ever reach a prompt.
// Free endpoints can log prompts, so no scores, IDs, demographics or free
// text are accepted here — even if a caller passes extra fields.
export function buildMessages(input: Pick<ExplainInput, 'instrument' | 'band' | 'language'>) {
  const instrument = INSTRUMENT_LABEL[input.instrument] ?? INSTRUMENT_LABEL.PHQ9;
  const language = LANGUAGE_NAME[input.language] ?? LANGUAGE_NAME.en;
  const band = BANDS.includes(input.band) ? input.band : 'moderate';
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Reply in ${language}. Instrument: ${instrument}. Screening band: ${band}. Explain gently what this band generally means and what it does not mean — a screening, not a diagnosis. Say that a health professional should confirm what this means for the person. Do not add any decision or advice beyond following the support steps already shown.`,
    },
  ];
}

// Circuit breaker: after 3 consecutive request failures, skip all LLM
// providers for 5 minutes and serve templates.
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export function resetBreaker() {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}
export function breakerRemainingMs(): number {
  return Math.max(0, breakerOpenUntil - Date.now());
}
function breakerOpen() {
  return Date.now() < breakerOpenUntil;
}
function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
}
function recordSuccess() {
  consecutiveFailures = 0;
}

type ChatOutcome =
  | { kind: 'ok'; text: string; model: string }
  | { kind: 'daily' }
  | { kind: 'array' }
  | { kind: 'fail' };

async function chatRequest(
  provider: Provider,
  models: string[],
  messages: { role: string; content: string }[],
): Promise<ChatOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Reasoning models spend hundreds of tokens thinking before any content;
    // a small cap returns null content. The validator still enforces <120 words.
    const body: Record<string, unknown> = { max_tokens: 1200, temperature: 0.4, messages };
    if (models.length > 1) body.models = models;
    else body.model = models[0];
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) return { kind: 'fail' };
      const model = typeof data?.model === 'string' ? data.model : models[0];
      return { kind: 'ok', text: text.trim(), model };
    }
    const errText = await res.text().catch(() => '');
    // A daily-limit 429 means ALL free models are exhausted — stop retrying.
    if (res.status === 429 && /per-day|daily/i.test(errText)) return { kind: 'daily' };
    if (res.status === 400 && models.length > 1 && /models/i.test(errText)) return { kind: 'array' };
    return { kind: 'fail' };
  } catch {
    return { kind: 'fail' };
  } finally {
    clearTimeout(timer);
  }
}

export interface Generated extends Explanation {
  model?: string;
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export async function generateExplanation(input: ExplainInput): Promise<Generated> {
  const template = (): Generated => ({ text: explainTemplate(input), source: 'template' });
  // Crisis is ALWAYS the fixed template — never an LLM, never cached.
  if (input.band === 'crisis') return template();
  if (breakerOpen()) return template();
  const providers = getProviders();
  if (providers.length === 0) return template();
  const messages = buildMessages(input);

  const accept = (o: { text: string; model: string }, provider: Provider): Generated | null => {
    if (!validateExplanation(o.text, input.language)) return null;
    recordSuccess();
    // Server logs only — the model name never goes to the client.
    console.log(`[jisr-llm] provider=${provider.name} model=${o.model}`);
    return { text: o.text, source: 'llm', model: o.model };
  };

  const openrouter = providers.find((p) => p.name === 'openrouter');
  if (openrouter) {
    const freeModels = await getFreeModels();
    const groups = chunk(freeModels.slice(0, MAX_GROUPS * MAX_MODELS_PER_REQUEST), MAX_MODELS_PER_REQUEST);
    outer: for (const group of groups) {
      const pending: string[][] = [group];
      while (pending.length > 0) {
        const g = pending.shift()!;
        const o = await chatRequest(openrouter, g, messages);
        if (o.kind === 'ok') {
          const accepted = accept(o, openrouter);
          return accepted ?? template();
        }
        if (o.kind === 'daily') {
          recordFailure();
          break outer;
        }
        if (o.kind === 'array') {
          // API rejected the array size: retry smallest first, remainder second.
          pending.unshift(g.slice(1), [g[0]]);
          continue;
        }
        recordFailure();
      }
    }
  }

  const second = providers.find((p) => p.name === 'llm2');
  if (second) {
    const o = await chatRequest(second, [second.model!], messages);
    if (o.kind === 'ok') {
      const accepted = accept(o, second);
      return accepted ?? template();
    }
    recordFailure();
  }
  return template();
}