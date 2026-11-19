// ============================================================================
// EMERGENCY CONTACT CONFIG — PLACEHOLDERS ONLY
// VERIFY WITH ABU DHABI DEPARTMENT OF HEALTH BEFORE DEMO
// These are NOT real numbers. Do not invent or publish real numbers here
// without official verification (hard rule 3).
// ============================================================================

export const EMERGENCY_CONFIG = {
  verificationNotice:
    'VERIFY WITH ABU DHABI DEPARTMENT OF HEALTH BEFORE DEMO — all numbers below are placeholders.',
  ambulance: {
    label: 'Ambulance (placeholder)',
    number: 'PLACEHOLDER — VERIFY WITH ABU DHABI DEPARTMENT OF HEALTH BEFORE DEMO',
  },
  mentalHealthLine: {
    label: 'Mental health support line (placeholder)',
    number: 'PLACEHOLDER — VERIFY WITH ABU DHABI DEPARTMENT OF HEALTH BEFORE DEMO',
  },
  emergencyDepartment: {
    label: 'Nearest emergency department',
    number: 'Go to the nearest emergency department if you are in immediate danger.',
  },
  guidance: [
    'You are not alone. What you are feeling is treatable, and help is available right now.',
    'If you are in immediate danger, call the emergency number below or go to the nearest emergency department.',
    'Stay with someone you trust, or ask someone to stay with you.',
    'A human care navigator has been alerted and will respond to your case immediately.',
  ],
  talkToHumanLabel: 'Talk to a human now',
} as const;