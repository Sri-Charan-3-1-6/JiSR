import type { Instrument } from './scoring';

// Fixed crisis rules — never AI (hard rule 3).
// Keywords are matched case-insensitively in any free-text field.
export const CRISIS_KEYWORDS = [
  // English
  'suicide',
  'suicidal',
  'kill myself',
  'killing myself',
  'end my life',
  'ending my life',
  'want to die',
  'better off dead',
  'self harm',
  'self-harm',
  'hurt myself',
  'harming myself',
  // Arabic
  'انتحار',
  'أنتحر',
  'اقتل نفسي',
  'أذي نفسي',
  'إيذاء نفسي',
  'أريد أن أموت',
  // Hindi
  'आत्महत्या',
  'खुदकुशी',
  'मरना चाहता',
  'मरना चाहती',
  'खुद को नुकसान',
];

export interface CrisisResult {
  crisis: boolean;
  reason: 'item9' | 'keyword' | null;
}

export function detectCrisis(
  instrument: Instrument,
  answers: number[],
  freeText?: string | null,
): CrisisResult {
  if (instrument === 'PHQ9' && (answers[8] ?? 0) > 0) {
    return { crisis: true, reason: 'item9' };
  }
  if (freeText) {
    const text = freeText.toLowerCase();
    if (CRISIS_KEYWORDS.some((k) => text.includes(k.toLowerCase()))) {
      return { crisis: true, reason: 'keyword' };
    }
  }
  return { crisis: false, reason: null };
}