// ============================================================================
// EMERGENCY CONTACTS — official Abu Dhabi / UAE numbers.
// Taken from official Abu Dhabi sources on 21 Nov 2026. The digits are the
// same in every language; only the labels are translated. Re-verify before
// any real deployment. No opening hours are shown. Every number is a
// tap-to-call tel: link on the emergency page.
// ============================================================================

export interface EmergencyContact {
  key: 'ambulance' | 'police' | 'istijaba' | 'hope' | 'sakina';
  number: string;
  tel: string;
}

export const EMERGENCY_CONTACTS: readonly EmergencyContact[] = [
  { key: 'ambulance', number: '998', tel: '998' },
  { key: 'police', number: '999', tel: '999' },
  { key: 'istijaba', number: '800 1717', tel: '8001717' },
  { key: 'hope', number: '800 4673', tel: '8004673' },
  { key: 'sakina', number: '800 725462', tel: '800725462' },
];

export const EMERGENCY_SOURCE_DATE = '2026-11-21';