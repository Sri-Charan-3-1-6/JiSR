import type { Language } from '../explain';

// Every LLM response must pass these checks or the fixed template is used.
// Rules: short (<120 words), requested language, says what the result means
// AND what it does not mean, never diagnoses or mentions medication.

const NOT_DIAGNOSIS: Record<Language, RegExp> = {
  en: /screening|not a diagnosis/i,
  ar: /ليس تشخيص|فحص استرشادي/,
  hi: /निदान नहीं|स्क्रीनिंग/,
};

const MEANS: Record<Language, RegExp> = {
  en: /symptom|level|suggest|score|result/i,
  ar: /أعراض|مستوى|تشير|نتيجة/,
  hi: /लक्षण|स्तर|बताते|परिणाम/,
};

const FORBIDDEN: Record<Language, RegExp> = {
  en: /\b(mg|milligrams?|medications?|antidepressants?|prescrib\w*|dosage|sertraline|fluoxetine|paroxetine|citalopram|escitalopram|prozac|zoloft|xanax|valium|diazepam|lorazepam|diagnosed with|i diagnose|you have (depression|bipolar|ptsd|schizophrenia|an anxiety disorder))\b/i,
  ar: /دواء|أدوية|ملغ|مليغرام|مضاد للاكتئاب|أنت مصاب|تم تشخيصك|وصفة طبية/,
  hi: /दवा|मिलीग्राम|एंटीडिप्रेसेंट|नुस्खा|निदान किया गया/,
};

const ARABIC = /[؀-ۿ]/g;
const DEVANAGARI = /[ऀ-ॿ]/g;

function scriptRatio(text: string, re: RegExp): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(re)?.length ?? 0) / letters;
}

export function validateExplanation(text: unknown, language: Language): text is string {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words < 10 || words >= 120) return false;

  if (language === 'ar' && scriptRatio(t, ARABIC) < 0.5) return false;
  if (language === 'hi' && scriptRatio(t, DEVANAGARI) < 0.5) return false;
  if (language === 'en' && (/[؀-ۿ]/.test(t) || /[ऀ-ॿ]/.test(t) || scriptRatio(t, /[A-Za-z]/g) < 0.5)) {
    return false;
  }

  if (!NOT_DIAGNOSIS[language].test(t)) return false;
  if (!MEANS[language].test(t)) return false;
  if (FORBIDDEN[language].test(t)) return false;
  return true;
}