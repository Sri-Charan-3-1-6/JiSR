import { describe, expect, it } from 'vitest';
import { score } from '@/lib/scoring';
import { detectCrisis } from '@/lib/crisis';
import {
  DEMO_ANSWERS,
  DEMO_CASE_ID,
  DEMO_RESIDENT_ID,
  DEMO_STEPS,
  DEMO_MISSED_DAY,
  createDemoStore,
  handleDemoRequest,
} from '@/lib/demo/story';

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

  it('has exactly 6 guided steps with the story routes', () => {
    expect(DEMO_STEPS).toHaveLength(6);
    expect(DEMO_STEPS.map((s) => s.route)).toEqual([
      '/resident/screen/PHQ9',
      `/resident/result/${DEMO_CASE_ID}`,
      `/resident/result/${DEMO_CASE_ID}`,
      '/navigator',
      `/navigator/case/${DEMO_CASE_ID}`,
      '/health-system',
    ]);
    expect(DEMO_STEPS[2].scrollTo).toBe('match');
    expect(DEMO_STEPS[3].day).toBe(DEMO_MISSED_DAY);
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
    expect(body.scopes.length).toBe(5);
    expect(body.scopes.every((s) => s.granted)).toBe(true);
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