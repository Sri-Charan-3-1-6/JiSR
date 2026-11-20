import { describe, expect, it } from 'vitest';
import {
  CONTACT_TEMPLATE,
  buildContactMessage,
  containsHealthData,
  waLink,
} from '@/lib/trusted-contact';

describe('trusted-contact message (generic by construction)', () => {
  it('uses the exact generic template with a pseudonymous handle', () => {
    expect(CONTACT_TEMPLATE).toBe("[Name] asked us to let you know they'd appreciate a call.");
    expect(buildContactMessage('JISR-DEMO-099')).toBe(
      "JISR-DEMO-099 asked us to let you know they'd appreciate a call.",
    );
  });

  it('never contains health data for any pseudonymous handle', () => {
    for (const handle of ['JISR-DEMO-099', 'JISR-SYN-0001', 'JISR-SYN-2000']) {
      expect(containsHealthData(buildContactMessage(handle))).toBe(false);
    }
  });

  it('detects leaked health wording', () => {
    expect(containsHealthData('Your PHQ-9 score was 10')).toBe(true);
    expect(containsHealthData('depression screening result')).toBe(true);
    expect(containsHealthData('anxiety levels are high')).toBe(true);
    expect(containsHealthData('mental health follow-up')).toBe(true);
    expect(containsHealthData('mood assessment')).toBe(true);
    expect(containsHealthData('GAD-7')).toBe(true);
    expect(containsHealthData('crisis callback')).toBe(true);
  });

  it('passes ordinary wording', () => {
    expect(containsHealthData('please give them a call when you can')).toBe(false);
    expect(containsHealthData('Reply recorded: contact made.')).toBe(false);
  });

  it('builds a prefilled wa.me link with digits only', () => {
    const msg = buildContactMessage('JISR-DEMO-099');
    expect(waLink('+971 50 000 0002', msg)).toBe(
      `https://wa.me/971500000002?text=${encodeURIComponent(msg)}`,
    );
  });
});