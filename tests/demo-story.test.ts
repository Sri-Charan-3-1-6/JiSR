import { describe, expect, it } from 'vitest';
import { score } from '@/lib/scoring';
import { detectCrisis } from '@/lib/crisis';
import {
  DEMO_ANSWERS,
  DEMO_CASE_ID,
  DEMO_CONTACT_ID,
  DEMO_RESIDENT_ID,
  DEMO_STEPS,
  DEMO_TASK_ID,
  DEMO_MISSED_DAY,
  createDemoStore,
  handleDemoRequest,
} from '@/lib/demo/story';
import { containsHealthData } from '@/lib/trusted-contact';

const get = (path: string, store = createDemoStore()) =>
  handleDemoRequest(path, { method: 'GET' }, store);
const post = (path: string, body: unknown, store = createDemoStore()) =>
  handleDemoRequest(path, { method: 'POST', body: JSON.stringify(body) }, store);

describe('demo story fixtures', () => {
  it('seeded PHQ-9 answers score 10 = moderate, item 9 = 0, no crisis', () => {
    const result = score('PHQ9', DEMO_ANSWERS);
    expect(result.total).toBe(10);
    expect(result.band).toBe('moderate');
    expect(DEMO_ANSWERS[8]).toBe(0);
    expect(detectCrisis('PHQ9', DEMO_ANSWERS, null).crisis).toBe(false);
  });

  it('has exactly 8 guided steps with the story routes', () => {
    expect(DEMO_STEPS).toHaveLength(8);
    expect(DEMO_STEPS.map((s) => s.route)).toEqual([
      '/resident/screen/PHQ9',
      `/resident/result/${DEMO_CASE_ID}`,
      `/resident/result/${DEMO_CASE_ID}`,
      '/navigator',
      `/navigator/case/${DEMO_CASE_ID}`,
      '/health-system',
      '/resident/checkin',
      '/resident/trusted-contact',
    ]);
    expect(DEMO_STEPS[2].scrollTo).toBe('match');
    expect(DEMO_STEPS[3].day).toBe(DEMO_MISSED_DAY);
    expect(DEMO_STEPS[6].day).toBe(DEMO_MISSED_DAY);
    expect(DEMO_MISSED_DAY).toBeGreaterThan(7);
  });

  it('is deterministic: two fresh stores return identical case payloads', () => {
    const a = get(`/api/cases/${DEMO_CASE_ID}`);
    const b = get(`/api/cases/${DEMO_CASE_ID}`);
    expect(a.body).toEqual(b.body);
  });
});

describe('demo API: screening and result', () => {
  it('POST /api/screenings returns the seeded case without crisis', () => {
    const store = createDemoStore();
    const res = post('/api/screenings', { instrument: 'PHQ9', answers: DEMO_ANSWERS }, store);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      residentId: DEMO_RESIDENT_ID,
      caseId: DEMO_CASE_ID,
      crisis: { crisis: false },
    });
  });

  it('GET case exposes a Hindi-speaking young worker, moderate PHQ-9', () => {
    const res = get(`/api/cases/${DEMO_CASE_ID}`);
    expect(res.status).toBe(200);
    const body = res.body as { case: Record<string, unknown> };
    expect(body.case).toMatchObject({
      id: DEMO_CASE_ID,
      language: 'hi',
      age_band: '18-24',
      risk_tier: 'moderate',
      instrument: 'PHQ9',
      total_score: 10,
      score_band: 'moderate',
      crisis_flag: false,
      state: 'SCREENED',
    });
    expect(String(body.case.pseudo_id)).toMatch(/^JISR-/);
  });

  it('POST /api/explain returns the deterministic template, never llm', () => {
    const en = post('/api/explain', { instrument: 'PHQ9', total: 10, band: 'moderate', language: 'en' });
    expect(en.status).toBe(200);
    const enBody = en.body as { text: string; source: string };
    expect(enBody.source).toBe('template');
    expect(enBody.text).toContain('screening, not a diagnosis');
    const hi = post('/api/explain', { instrument: 'PHQ9', total: 10, band: 'moderate', language: 'hi' });
    expect((hi.body as { text: string }).text).toMatch(/[ऀ-ॿ]/);
  });
});

describe('demo API: SLA clock and overdue queue', () => {
  it('is not overdue on day 0 and overdue by 5 days after the missed follow-up', () => {
    const store = createDemoStore();
    const fresh = get(`/api/cases/${DEMO_CASE_ID}`, store).body as { sla: { is_overdue: boolean } };
    expect(fresh.sla.is_overdue).toBe(false);

    store.day = DEMO_MISSED_DAY;
    const late = get(`/api/cases/${DEMO_CASE_ID}`, store).body as {
      sla: { is_overdue: boolean; next_milestone: string; overdue_by: { days?: number } };
    };
    expect(late.sla.is_overdue).toBe(true);
    expect(late.sla.next_milestone).toBe('contact');
    expect(late.sla.overdue_by.days).toBe(DEMO_MISSED_DAY - 7);
  });

  it('navigator queue shows the overdue case and the simulated clock offset', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    const res = get('/api/navigator/queue', store);
    const body = res.body as {
      cases: Array<{ id: string; is_overdue: boolean }>;
      clock: { now: string; offset: string };
    };
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]).toMatchObject({ id: DEMO_CASE_ID, is_overdue: true });
    expect(body.clock.offset).toContain('12 days');
  });

  it('POST /api/demo/clock advances whole days and rejects invalid input', () => {
    const store = createDemoStore();
    expect(post('/api/demo/clock', { days: 3 }, store).status).toBe(200);
    expect(store.day).toBe(3);
    expect(post('/api/demo/clock', { days: 0 }, store).status).toBe(400);
    expect(post('/api/demo/clock', { days: 31 }, store).status).toBe(400);
  });
});

describe('demo API: accept, navigator call, timeline', () => {
  it('accept moves SCREENED -> MATCHED and appends a state event', () => {
    const store = createDemoStore();
    const res = post(`/api/cases/${DEMO_CASE_ID}/state`, { toState: 'MATCHED' }, store);
    expect(res.status).toBe(200);
    expect(store.state).toBe('MATCHED');
    const body = get(`/api/cases/${DEMO_CASE_ID}`, store).body as {
      case: { state: string };
      events: Array<{ event_type: string; to_state: string }>;
    };
    expect(body.case.state).toBe('MATCHED');
    expect(body.events.some((e) => e.event_type === 'state_change' && e.to_state === 'MATCHED')).toBe(true);
  });

  it('rejects skipping states', () => {
    const store = createDemoStore();
    expect(post(`/api/cases/${DEMO_CASE_ID}/state`, { toState: 'ATTENDED' }, store).status).toBe(400);
  });

  it('logging a reached call records outreach and clears the overdue SLA after contact', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    post(`/api/cases/${DEMO_CASE_ID}/state`, { toState: 'MATCHED' }, store);
    const res = post(
      `/api/cases/${DEMO_CASE_ID}/outreach`,
      { channel: 'call', outcome: 'reached', note: 'Speaks Hindi; prefers evening calls.' },
      store,
    );
    expect(res.status).toBe(200);
    post(`/api/cases/${DEMO_CASE_ID}/state`, { toState: 'NAVIGATOR_CONTACTED' }, store);
    const body = get(`/api/cases/${DEMO_CASE_ID}`, store).body as {
      sla: { is_overdue: boolean };
      outreach: Array<{ channel: string; outcome: string; note: string }>;
    };
    expect(body.outreach).toHaveLength(1);
    expect(body.outreach[0]).toMatchObject({ channel: 'call', outcome: 'reached' });
    expect(body.sla.is_overdue).toBe(false);
    const queue = get('/api/navigator/queue', store).body as { cases: Array<{ is_overdue: boolean }> };
    expect(queue.cases[0].is_overdue).toBe(false);
  });
});

describe('demo API: Gap Finder language gap', () => {
  it('shows Hindi speakers with a lower screen-to-match rate flagged as a gap', () => {
    const res = get('/api/gapfinder');
    expect(res.status).toBe(200);
    const body = res.body as {
      metrics: { screen_to_match_rate: string };
      fairness: Array<{ dimension: string; group_value: string; n: string; screen_to_match: string; is_gap: boolean }>;
      suppressed: Array<{ dimension: string; group_value: string }>;
      counts: { residents_total: number };
    };
    const lang = body.fairness.filter((r) => r.dimension === 'language');
    const hi = lang.find((r) => r.group_value === 'hi');
    const en = lang.find((r) => r.group_value === 'en');
    expect(hi?.is_gap).toBe(true);
    expect(en?.is_gap).toBe(false);
    expect(Number(hi?.screen_to_match)).toBeLessThan(Number(en?.screen_to_match));
    expect(lang.every((r) => Number(r.n) >= 10)).toBe(true);
    expect(body.suppressed.length).toBeGreaterThan(0);
    expect(Number(body.metrics.screen_to_match_rate)).toBeGreaterThan(0);
    expect(body.counts.residents_total).toBeGreaterThan(0);
  });
});

describe('demo API: consent and off-story routes', () => {
  it('serves consent scopes and records toggles with an audit entry', () => {
    const store = createDemoStore();
    const res = get(`/api/residents/${DEMO_RESIDENT_ID}/consent`, store);
    const body = res.body as {
      resident: { pseudo_id: string };
      scopes: Array<{ scope: string; granted: boolean }>;
      audit: unknown[];
    };
    expect(body.scopes.length).toBe(7);
    expect(body.scopes.every((s) => s.granted)).toBe(true);
    expect(body.scopes.map((s) => s.scope)).toContain('reminders');
    expect(body.scopes.map((s) => s.scope)).toContain('trusted_contact');
    const auditBefore = body.audit.length;
    post(`/api/residents/${DEMO_RESIDENT_ID}/consent`, { scope: 'wearable_signal', granted: false }, store);
    const after = get(`/api/residents/${DEMO_RESIDENT_ID}/consent`, store).body as typeof body;
    expect(after.scopes.find((s) => s.scope === 'wearable_signal')?.granted).toBe(false);
    expect(after.audit.length).toBeGreaterThan(auditBefore);
  });

  it('resident cases list contains the demo case', () => {
    const res = get(`/api/residents/${DEMO_RESIDENT_ID}/cases`);
    const body = res.body as { cases: Array<{ id: string }>; consentRequired: boolean };
    expect(body.cases[0].id).toBe(DEMO_CASE_ID);
    expect(body.consentRequired).toBe(false);
  });

  it('returns 503 for off-story API routes instead of reaching the network', () => {
    const res = get('/api/employer/aggregate');
    expect(res.status).toBe(503);
    expect((res.body as { error: string }).error).toBeTruthy();
  });
});

const put = (path: string, body: unknown, store = createDemoStore()) =>
  handleDemoRequest(path, { method: 'PUT', body: JSON.stringify(body) }, store);
const R = DEMO_RESIDENT_ID;
const EVAL = `/api/residents/${R}/checkins/evaluate`;

describe('demo API: Layer 5 reminder ladder', () => {
  it('sends a reminder for the open check-in and stops the exhausted missed one', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    store.prefs.quietStart = '00:00';
    store.prefs.quietEnd = '00:00'; // start === end disables quiet hours, TZ-independent
    const body = post(EVAL, {}, store).body as { events: Array<{ kind: string }> };
    expect(body.events.some((e) => e.kind === 'reminder')).toBe(true);
    expect(body.events.some((e) => e.kind === 'stopped')).toBe(true);
    const missed = store.checkins.find((c) => c.id === 'demo-checkin-missed');
    expect(missed?.state).toBe('stopped');
  });

  it('respects quiet hours: no reminder is sent during the quiet window', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    store.prefs.quietStart = '00:00';
    store.prefs.quietEnd = '23:59';
    const body = post(EVAL, {}, store).body as { events: Array<{ kind: string }> };
    expect(body.events.some((e) => e.kind === 'reminder')).toBe(false);
    expect(body.events.some((e) => e.kind === 'skipped_quiet_hours')).toBe(true);
  });

  it('respects the daily cap: a zero cap skips sends without a reminder', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    store.prefs.quietStart = '00:00';
    store.prefs.quietEnd = '00:00';
    store.prefs.maxPerDay = 0;
    const body = post(EVAL, {}, store).body as { events: Array<{ kind: string }> };
    expect(body.events.some((e) => e.kind === 'reminder')).toBe(false);
    expect(body.events.some((e) => e.kind === 'skipped_daily_cap')).toBe(true);
  });

  it('completing and snoozing a check-in records the matching event', () => {
    const store = createDemoStore();
    store.day = DEMO_MISSED_DAY;
    const done = post('/api/checkins/demo-checkin-pending/complete', {}, store);
    expect(done.status).toBe(200);
    expect(store.checkins.find((c) => c.id === 'demo-checkin-pending')?.state).toBe('completed');
    const snoozed = post('/api/checkins/demo-checkin-missed/snooze', {}, store);
    expect(snoozed.status).toBe(400); // a missed check-in cannot be snoozed
    expect(store.reminderEvents.some((e) => e.kind === 'completed')).toBe(true);
  });
});

describe('demo API: Layer 5 trusted contact guards', () => {
  it('exposes the seeded contact and an eligible failed-call task', () => {
    const body = get(`/api/residents/${R}/trusted-contact`).body as {
      contact: { contact_label: string } | null;
      consent: boolean;
      eligibleTask: { id: string } | null;
    };
    expect(body.consent).toBe(true);
    expect(body.contact?.contact_label).toBe('Sister');
    expect(body.eligibleTask?.id).toBe(DEMO_TASK_ID);
  });

  it('refuses to send without trusted_contact consent', () => {
    const store = createDemoStore();
    store.consent.trusted_contact = false;
    const res = post(`/api/trusted-contact/${DEMO_CONTACT_ID}/send`, {}, store);
    expect(res.status).toBe(403);
    expect(store.contactEvents).toHaveLength(0);
  });

  it('sends only the generic message with no health data, then blocks a duplicate', () => {
    const store = createDemoStore();
    const res = post(`/api/trusted-contact/${DEMO_CONTACT_ID}/send`, {}, store);
    expect(res.status).toBe(200);
    const body = res.body as { message: string; waLink: string; simulated: boolean };
    expect(body.message).toBe("JISR-DEMO-099 asked us to let you know they'd appreciate a call.");
    expect(containsHealthData(body.message)).toBe(false);
    expect(body.simulated).toBe(true);
    expect(body.waLink.startsWith('https://wa.me/971500000000')).toBe(true);
    expect(post(`/api/trusted-contact/${DEMO_CONTACT_ID}/send`, {}, store).status).toBe(409);
  });

  it('records a reply only as contact made and resolves the task', () => {
    const store = createDemoStore();
    post(`/api/trusted-contact/${DEMO_CONTACT_ID}/send`, {}, store);
    const res = post(`/api/trusted-contact/${DEMO_CONTACT_ID}/reply`, {}, store);
    expect(res.status).toBe(200);
    expect((res.body as { kind: string }).kind).toBe('contact_made');
    expect(store.tasks.find((t) => t.id === DEMO_TASK_ID)?.resolved_at).toBeTruthy();
    const after = get(`/api/residents/${R}/trusted-contact`, store).body as { eligibleTask: unknown };
    expect(after.eligibleTask).toBeNull();
  });
});

describe('demo API: Layer 5 consent revocation and aggregates', () => {
  it('revoking reminders immediately empties the notification center and blocks evaluate', () => {
    const store = createDemoStore();
    post(`/api/residents/${R}/consent`, { scope: 'reminders', granted: false }, store);
    const feed = get(`/api/residents/${R}/notifications`, store).body as {
      events: unknown[];
      unread: number;
      consentRequired: boolean;
    };
    expect(feed.events).toEqual([]);
    expect(feed.unread).toBe(0);
    expect(feed.consentRequired).toBe(true);
    expect(post(EVAL, {}, store).status).toBe(403);
  });

  it('Gap Finder carries a check-in block with a Hindi completion gap and suppression', () => {
    const body = get('/api/gapfinder').body as {
      checkin: {
        metrics: { completion_rate: string };
        fairness: Array<{ dimension: string; group_value: string; n: string; is_gap: boolean }>;
        suppressed: unknown[];
        companion: { heavy_share: string };
      };
    };
    const lang = body.checkin.fairness.filter((r) => r.dimension === 'language');
    expect(lang.find((r) => r.group_value === 'hi')?.is_gap).toBe(true);
    expect(lang.find((r) => r.group_value === 'en')?.is_gap).toBe(false);
    expect(body.checkin.fairness.every((r) => Number(r.n) >= 10)).toBe(true);
    expect(body.checkin.suppressed.length).toBeGreaterThan(0);
    expect(Number(body.checkin.companion.heavy_share)).toBeGreaterThan(0);
  });

  it('hides jokes by default and shows them only after opt-in or faculty review', () => {
    const store = createDemoStore();
    const off = get('/api/calm/lines?language=en', store).body as { lines: Array<{ kind: string }> };
    expect(off.lines.every((l) => l.kind === 'support')).toBe(true);
    put(`/api/residents/${R}/companion-prefs`, { jokesOptIn: true }, store);
    const on = get('/api/calm/lines?language=en&jokes=1', store).body as { lines: Array<{ kind: string }> };
    expect(on.lines.some((l) => l.kind === 'joke')).toBe(true);
    const faculty = get('/api/calm/lines?language=en&review=1&jokes=1', store).body as { lines: Array<{ kind: string }> };
    expect(faculty.lines.some((l) => l.kind === 'joke')).toBe(true);
  });
});