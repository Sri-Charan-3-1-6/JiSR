// The trusted-contact message is generic by construction. It must NEVER
// contain scores, results or mental-health wording; containsHealthData is a
// belt-and-braces guard run before any simulated send.

export const CONTACT_TEMPLATE = "[Name] asked us to let you know they'd appreciate a call.";

const HEALTH_WORDS = [
  'score',
  'phq',
  'gad',
  'depress',
  'anxie',
  'mental',
  'screening',
  'result',
  'crisis',
  'symptom',
  'therap',
  'diagnos',
  'mood',
  'wellbeing',
];

export function buildContactMessage(handle: string): string {
  return CONTACT_TEMPLATE.replace('[Name]', handle);
}

export function containsHealthData(message: string): boolean {
  const text = message.toLowerCase();
  return HEALTH_WORDS.some((w) => text.includes(w));
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}