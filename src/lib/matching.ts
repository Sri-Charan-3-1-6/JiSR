import type { Band } from './scoring';

export type RiskTier = Band | 'crisis';

export interface SupportOption {
  key: string;
  title: string;
  eligibility: string;
  handoff: string;
}

export interface MatchResult {
  tier: RiskTier;
  why: string;
  options: SupportOption[];
  sla: {
    contactHours: number | null;
    bookHours: number | null;
    followupDays: number | null;
  };
  slaSummary: string;
}

// Stepped matching — deterministic rules, visible to the user as "why this
// suggestion" (Layer 1 spec). The LLM never matches support (hard rule 2).
export function matchSupport(tier: RiskTier): MatchResult {
  switch (tier) {
    case 'minimal':
      return {
        tier,
        why: 'Your score is in the minimal range (0-4). Most people at this level do well with self-help and a routine check-in.',
        options: [
          {
            key: 'self_help',
            title: 'Self-help resources',
            eligibility: 'Open to everyone — no referral needed.',
            handoff: 'Read the curated wellbeing guides in the app. We will invite you to re-screen in 30 days.',
          },
        ],
        sla: { contactHours: null, bookHours: null, followupDays: 30 },
        slaSummary: 'Re-screen in 30 days.',
      };
    case 'mild':
      return {
        tier,
        why: 'Your score is in the mild range (5-9). Self-help plus community support usually helps at this level; a navigator checks in within 14 days.',
        options: [
          {
            key: 'self_help',
            title: 'Self-help resources',
            eligibility: 'Open to everyone — no referral needed.',
            handoff: 'Start with the guided exercises in the app.',
          },
          {
            key: 'community_support',
            title: 'Community support group',
            eligibility: 'Open to all residents; no diagnosis or referral required.',
            handoff: 'A navigator shares the next group session and checks in with you within 14 days.',
          },
        ],
        sla: { contactHours: 14 * 24, bookHours: null, followupDays: null },
        slaSummary: 'Navigator check-in within 14 days.',
      };
    case 'moderate':
      return {
        tier,
        why: 'Your score is in the moderate range (10-14). Talking to a professional is recommended; you should be contacted within 7 days.',
        options: [
          {
            key: 'primary_care',
            title: 'Primary care appointment',
            eligibility: 'Any resident with a moderate score; no referral needed.',
            handoff: 'A navigator contacts you within 7 days and helps book a primary-care visit.',
          },
          {
            key: 'tele_mental_health',
            title: 'Tele-mental health session',
            eligibility: 'Any resident with a moderate score who prefers remote support.',
            handoff: 'A navigator contacts you within 7 days and arranges a video session.',
          },
        ],
        sla: { contactHours: 7 * 24, bookHours: null, followupDays: null },
        slaSummary: 'Human contact within 7 days.',
      };
    case 'moderately_severe':
    case 'severe':
      return {
        tier,
        why: `Your score is in the ${tier === 'severe' ? 'severe' : 'moderately severe'} range. Specialist support is recommended: a human navigator contacts you within 24 hours and an appointment is arranged within 72 hours.`,
        options: [
          {
            key: 'specialist',
            title: 'Specialist mental health service',
            eligibility: `Residents scoring ${tier === 'severe' ? '20-27 (PHQ-9) / 15-21 (GAD-7)' : '15-19 (PHQ-9)'}; navigator arranges the referral.`,
            handoff: 'Navigator calls within 24 hours, books the specialist appointment within 72 hours, and stays with you until you attend.',
          },
          {
            key: 'tele_mental_health',
            title: 'Tele-mental health (urgent)',
            eligibility: 'Same score range, if you prefer remote or cannot travel.',
            handoff: 'Navigator contacts you within 24 hours and arranges an urgent video session within 72 hours.',
          },
        ],
        sla: { contactHours: 24, bookHours: 72, followupDays: null },
        slaSummary: 'Navigator contact within 24 hours; appointment within 72 hours.',
      };
    case 'crisis':
      return {
        tier,
        why: 'Your answers suggest you may be at immediate risk. A human will help you right now — this is a fixed safety rule, not an automated judgement about your health.',
        options: [
          {
            key: 'human_immediately',
            title: 'Talk to a human now',
            eligibility: 'Everyone — no conditions, no waiting.',
            handoff: 'Emergency guidance is shown immediately and a CRITICAL case is created so a navigator responds right away.',
          },
        ],
        sla: { contactHours: 0, bookHours: null, followupDays: null },
        slaSummary: 'Human response immediately.',
      };
  }
}

export const STATE_ORDER = [
  'SCREENED',
  'MATCHED',
  'NAVIGATOR_CONTACTED',
  'BOOKED',
  'ATTENDED',
  'FOLLOWED_UP_30D',
] as const;

export type CaseState = (typeof STATE_ORDER)[number];

export function nextState(state: CaseState): CaseState | null {
  const i = STATE_ORDER.indexOf(state);
  return i >= 0 && i < STATE_ORDER.length - 1 ? STATE_ORDER[i + 1] : null;
}