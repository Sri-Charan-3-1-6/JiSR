import type { Language } from '../explain';
import { MAX_GROUPS, MAX_MODELS_PER_REQUEST, getProviders, type Provider } from './config';
import { getFreeModels } from './models';
import { breakerOpen, chatRequest, recordFailure, recordSuccess } from './client';
import {
  ARABIC,
  DEVANAGARI,
  DIAGNOSIS,
  NEGATED,
  TREATMENT,
  TREATMENT_CHANGE,
  scriptRatio,
} from './validate';

// Supportive check-in companion. The LLM listens and replies in plain, kind
// language. It NEVER diagnoses, scores, matches support, decides crisis, or
// gives medical advice — crisis is caught by fixed on-device rules before any
// text reaches a provider, and every reply is validated below. Conversation
// text is personal, so it is NEVER cached or logged; only the provider/model
// name is logged server-side.

const SYSTEM_PROMPT = `You are a gentle mental-wellbeing check-in companion inside a screening prototype.
Strict rules you must never break:
- You are NOT a professional, therapist or doctor. Never claim to be one.
- You do NOT diagnose, name conditions or disorders, label the person, or give medical advice.
- Never say "you have", "you are suffering from", "you are depressed/anxious", or "diagnosed with". Never name any disorder.
- Never mention medications, doses, or starting, stopping or changing any treatment.
- You do NOT decide crisis situations, score anything, match support options, or make any decision — fixed code and human navigators do that.
- If the person sounds distressed, validate their feelings warmly, never minimise them, and gently point to a human care navigator or a calming exercise. Never tell them whether they are in crisis.
- Avoid toxic positivity and never tell the person how they should feel.
- Be short (under 70 words), warm, calm and non-judgmental. Ask at most one gentle follow-up question.
- Reply ONLY in the requested language, with no preamble, no markdown, no lists.`;

const LANGUAGE_NAME: Record<Language, string> = { en: 'English', ar: 'Arabic', hi: 'Hindi' };

export interface CompanionTurn {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_TURNS = 10;
const MAX_TURN_CHARS = 1000;

// PRIVACY: only bounded role/content conversation turns and the language ever
// reach a prompt. No IDs, scores, demographics or other fields are accepted.
export function buildCompanionMessages(history: CompanionTurn[], language: Language) {
  const lang = LANGUAGE_NAME[language] ?? LANGUAGE_NAME.en;
  const turns = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TURN_CHARS) }));
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Reply in ${lang}.` },
    ...turns,
  ];
}

const MODEL_TALK = /https?:|openai|openrouter|\bgpt\b|\bllm\b|language model|as an ai/i;

// Every companion reply must pass these checks or a fixed supportive fallback
// is used. Short, in the requested language, and free of diagnosis/treatment
// wording. Negated reassurance ("this does not mean you have ...") is stripped
// before the diagnosis/treatment checks so it is not rejected.
export function validateCompanionReply(text: unknown, language: Language): text is string {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words < 3 || words >= 120) return false;

  if (language === 'ar' && scriptRatio(t, ARABIC) < 0.5) return false;
  if (language === 'hi' && scriptRatio(t, DEVANAGARI) < 0.5) return false;
  if (language === 'en' && (/[؀-ۿ]/.test(t) || /[ऀ-ॿ]/.test(t) || scriptRatio(t, /[A-Za-z]/g) < 0.5)) {
    return false;
  }
  if (MODEL_TALK.test(t)) return false;

  const stripped = t.replace(NEGATED[language], ' ');
  if (DIAGNOSIS[language].test(stripped)) return false;
  if (TREATMENT[language].test(stripped)) return false;
  if (TREATMENT_CHANGE[language].test(stripped)) return false;
  return true;
}

const FALLBACK: Record<Language, string> = {
  en: "Thank you for sharing that. I'm here to listen, not to label or judge how you feel. Whatever you're carrying is valid. If it feels heavy, a human care navigator can talk with you, or the Calm Corner has a quiet minute for you.",
  ar: "شكرًا لمشاركتك ذلك. أنا هنا لأستمع، لا لأصف مشاعرك أو أحكم عليها. ما تحمله مهم. إن بدا ثقيلًا، يمكن لميسّر رعاية بشري أن يتحدث معك، أو تجد في ركن الهدوء دقيقة هادئة لنفسك.",
  hi: "यह साझा करने के लिए धन्यवाद। मैं यहाँ सुनने के लिए हूँ, आपकी भावनाओं को नाम देने या आँकने के लिए नहीं। आप जो भी महसूस कर रहे हैं वह महत्वपूर्ण है। यदि यह भारी लगे, तो एक मानव केयर नेविगेटर आपसे बात कर सकता है, या शांत कोने में आपके लिए एक शांत मिनट है।",
};

export function fallbackCompanionReply(language: Language): string {
  return FALLBACK[language] ?? FALLBACK.en;
}

export interface CompanionReply {
  text: string;
  source: 'llm' | 'fallback';
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

// Shares the explain circuit breaker. Crisis is handled before this is ever
// called. No caching: conversation text is personal and must not be stored.
export async function generateCompanionReply(
  history: CompanionTurn[],
  language: Language,
): Promise<CompanionReply> {
  const fallback = (): CompanionReply => ({ text: fallbackCompanionReply(language), source: 'fallback' });
  if (breakerOpen()) return fallback();
  const providers = getProviders();
  if (providers.length === 0) return fallback();
  const messages = buildCompanionMessages(history, language);

  const accept = (o: { text: string; model: string }, provider: Provider): CompanionReply | null => {
    if (!validateCompanionReply(o.text, language)) return null;
    recordSuccess();
    console.log(`[jisr-companion] provider=${provider.name} model=${o.model}`);
    return { text: o.text, source: 'llm' };
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
          return accept(o, openrouter) ?? fallback();
        }
        if (o.kind === 'daily') {
          recordFailure();
          break outer;
        }
        if (o.kind === 'array') {
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
      return accept(o, second) ?? fallback();
    }
    recordFailure();
  }
  return fallback();
}