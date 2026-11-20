import { explainTemplate, type Language } from '@/lib/explain';
import { nextState, type CaseState } from '@/lib/matching';

// The demo story runs entirely on these seeded fixtures. While demo mode is
// active the provider intercepts every /api/ request and answers it from this
// store, so the story never touches the live backend.
export const DEMO_CASE_ID = 'demo-case';
export const DEMO_RESIDENT_ID = 'demo-resident';
export const DEMO_PSEUDO_ID = 'JISR-DEMO-099';
// Fixed synthetic anchor keeps the story deterministic across runs.
export const DEMO_ANCHOR_MS = Date.UTC(2026, 0, 5, 9, 0, 0);
export const DEMO_ANSWERS = [2, 1, 2, 1, 1, 1, 1, 1, 0];
export const DEMO_TOTAL = 10;
export const DEMO_MISSED_DAY = 12;
const CONTACT_SLA_DAYS = 7;

export interface DemoStep {
  route: string;
  scrollTo?: string;
  day?: number;
}

export const DEMO_STEPS: DemoStep[] = [
  { route: '/resident/screen/PHQ9' },
  { route: `/resident/result/${DEMO_CASE_ID}` },
  { route: `/resident/result/${DEMO_CASE_ID}`, scrollTo: 'match' },
  { route: '/navigator', day: DEMO_MISSED_DAY },
  { route: `/navigator/case/${DEMO_CASE_ID}` },
  { route: '/health-system' },
];

interface DemoEvent {
  id: number;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface DemoOutreach {
  id: number;
  channel: string;
  outcome: string;
  note: string | null;
  attempted_at: string;
}

const CONSENT_SCOPES = [
  'store_results',
  'share_with_primary_care',
  'anonymous_aggregate_stats',
  'wearable_signal',
  'navigator_contact',
] as const;

export interface DemoStore {
  day: number;
  state: CaseState;
  events: DemoEvent[];
  outreach: DemoOutreach[];
  consent: Record<string, boolean>;
  audit: Array<{ scope: string; action: string; actor: string; created_at: string }>;
}

export function createDemoStore(): DemoStore {
  return {
    day: 0,
    state: 'SCREENED',
    events: [
      {
        id: 1,
        event_type: 'state_change',
        from_state: null,
        to_state: 'SCREENED',
        detail: null,
        created_at: iso(0),
      },
    ],
    outreach: [],
    consent: Object.fromEntries(CONSENT_SCOPES.map((s) => [s, true])),
    audit: CONSENT_SCOPES.map((scope, i) => ({
      scope,
      action: 'granted',
      actor: 'resident',
      created_at: iso(0, i * 60_000),
    })),
  };
}

function iso(day: number, extraMs = 0): string {
  return new Date(DEMO_ANCHOR_MS + day * 86400_000 + extraMs).toISOString();
}

export function demoNow(store: DemoStore): string {
  return iso(store.day);
}

function clock(store: DemoStore) {
  return { now: demoNow(store), offset: `${store.day} days 00:00:00` };
}

function sla(store: DemoStore) {
  const contacted =
    store.state === 'NAVIGATOR_CONTACTED' ||
    store.state === 'BOOKED' ||
    store.state === 'ATTENDED' ||
    store.state === 'FOLLOWED_UP_30D';
  if (contacted) {
    return { next_milestone: null, next_due: null, is_overdue: false, overdue_by: {} };
  }
  const dueMs = DEMO_ANCHOR_MS + CONTACT_SLA_DAYS * 86400_000;
  const overdueMs = DEMO_ANCHOR_MS + store.day * 86400_000 - dueMs;
  return {
    next_milestone: 'contact',
    next_due: iso(CONTACT_SLA_DAYS),
    is_overdue: overdueMs > 0,
    overdue_by: overdueMs > 0 ? { days: Math.floor(overdueMs / 86400_000) } : {},
  };
}

function caseDetail(store: DemoStore) {
  return {
    id: DEMO_CASE_ID,
    pseudo_id: DEMO_PSEUDO_ID,
    language: 'hi',
    age_band: '18-24',
    area: 'Area 3',
    risk_tier: 'moderate',
    state: store.state,
    instrument: 'PHQ9',
    answers: DEMO_ANSWERS,
    free_text: null,
    total_score: DEMO_TOTAL,
    score_band: 'moderate',
    crisis_flag: false,
    crisis_reason: null,
    created_at: iso(0),
    sla_contact_due: iso(CONTACT_SLA_DAYS),
    sla_book_due: null,
    sla_followup_due: null,
  };
}

// Synthetic aggregate snapshot for the Gap Finder step: Hindi-speaking
// residents convert from screen to match at a visibly lower rate.
const GAPFINDER = {
  metrics: {
    cases_total: '248',
    matched_total: '205',
    screen_to_match_rate: '0.827',
    match_to_booked_sla_rate: '0.78',
    booked_to_attended_rate: '0.85',
    median_days_to_followup: '28',
    median_waiting_days: '4.5',
    crisis_total: '12',
    crisis_responded: '12',
    crisis_response_completion: '1',
    adverse_missed_crisis_callbacks: '0',
  },
  improvement: {
    paired_residents: '58',
    avg_score_reduction: '3.2',
    improved: '41',
    improvement_rate: '0.707',
  },
  fairness: [
    { dimension: 'language', group_value: 'ar', n: '96', screen_to_match: '0.84', match_to_booked_sla: '0.79', booked_to_attended: '0.86', median_waiting_days: '4.2', best_screen_to_match: '0.92', is_gap: false, best_match_to_booked: '0.82', is_gap_booked: false },
    { dimension: 'language', group_value: 'en', n: '108', screen_to_match: '0.92', match_to_booked_sla: '0.82', booked_to_attended: '0.88', median_waiting_days: '3.6', best_screen_to_match: '0.92', is_gap: false, best_match_to_booked: '0.82', is_gap_booked: false },
    { dimension: 'language', group_value: 'hi', n: '44', screen_to_match: '0.61', match_to_booked_sla: '0.64', booked_to_attended: '0.78', median_waiting_days: '7.1', best_screen_to_match: '0.92', is_gap: true, best_match_to_booked: '0.82', is_gap_booked: true },
    { dimension: 'age_band', group_value: '18-24', n: '82', screen_to_match: '0.78', match_to_booked_sla: '0.74', booked_to_attended: '0.82', median_waiting_days: '5.1', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'age_band', group_value: '25-34', n: '94', screen_to_match: '0.87', match_to_booked_sla: '0.81', booked_to_attended: '0.87', median_waiting_days: '4', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'age_band', group_value: '35-44', n: '72', screen_to_match: '0.83', match_to_booked_sla: '0.79', booked_to_attended: '0.86', median_waiting_days: '4.4', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'gender', group_value: 'female', n: '126', screen_to_match: '0.86', match_to_booked_sla: '0.8', booked_to_attended: '0.87', median_waiting_days: '4.1', best_screen_to_match: '0.86', is_gap: false, best_match_to_booked: '0.8', is_gap_booked: false },
    { dimension: 'gender', group_value: 'male', n: '110', screen_to_match: '0.79', match_to_booked_sla: '0.76', booked_to_attended: '0.83', median_waiting_days: '5', best_screen_to_match: '0.86', is_gap: false, best_match_to_booked: '0.8', is_gap_booked: false },
    { dimension: 'nationality', group_value: 'Group A', n: '92', screen_to_match: '0.88', match_to_booked_sla: '0.81', booked_to_attended: '0.88', median_waiting_days: '3.9', best_screen_to_match: '0.88', is_gap: false, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'nationality', group_value: 'Group B', n: '84', screen_to_match: '0.82', match_to_booked_sla: '0.78', booked_to_attended: '0.85', median_waiting_days: '4.6', best_screen_to_match: '0.88', is_gap: false, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'nationality', group_value: 'Group C', n: '60', screen_to_match: '0.75', match_to_booked_sla: '0.72', booked_to_attended: '0.8', median_waiting_days: '5.8', best_screen_to_match: '0.88', is_gap: true, best_match_to_booked: '0.81', is_gap_booked: false },
    { dimension: 'area', group_value: 'Area 1', n: '88', screen_to_match: '0.87', match_to_booked_sla: '0.8', booked_to_attended: '0.87', median_waiting_days: '4', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.8', is_gap_booked: false },
    { dimension: 'area', group_value: 'Area 2', n: '80', screen_to_match: '0.83', match_to_booked_sla: '0.78', booked_to_attended: '0.85', median_waiting_days: '4.5', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.8', is_gap_booked: false },
    { dimension: 'area', group_value: 'Area 3', n: '80', screen_to_match: '0.78', match_to_booked_sla: '0.76', booked_to_attended: '0.83', median_waiting_days: '5.2', best_screen_to_match: '0.87', is_gap: false, best_match_to_booked: '0.8', is_gap_booked: false },
  ],
  suppressed: [{ dimension: 'nationality', group_value: 'Group D' }],
  counts: { residents_total: 260 },
};

export interface DemoResponse {
  status: number;
  body: unknown;
}

const ok = (body: unknown): DemoResponse => ({ status: 200, body });

export function handleDemoRequest(
  path: string,
  init: { method?: string; body?: string | null },
  store: DemoStore,
): DemoResponse {
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  const route = `${method} ${path.split('?')[0]}`;

  switch (route) {
    case 'POST /api/screenings':
      return ok({ residentId: DEMO_RESIDENT_ID, caseId: DEMO_CASE_ID, crisis: { crisis: false, reason: null } });

    case `GET /api/cases/${DEMO_CASE_ID}`:
      return ok({ case: caseDetail(store), sla: sla(store), events: store.events, outreach: store.outreach });

    case `POST /api/cases/${DEMO_CASE_ID}/state`: {
      const to = body.toState as CaseState;
      if (nextState(store.state) !== to) {
        return { status: 400, body: { error: `Invalid transition ${store.state} -> ${to}` } };
      }
      store.events.push({
        id: store.events.length + 1,
        event_type: 'state_change',
        from_state: store.state,
        to_state: to,
        detail: null,
        created_at: demoNow(store),
      });
      store.state = to;
      return ok({ ok: true, state: to });
    }

    case `POST /api/cases/${DEMO_CASE_ID}/outreach`: {
      const row: DemoOutreach = {
        id: store.outreach.length + 1,
        channel: String(body.channel ?? 'call'),
        outcome: String(body.outcome ?? 'reached'),
        note: (body.note as string | null) ?? null,
        attempted_at: demoNow(store),
      };
      store.outreach.push(row);
      store.events.push({
        id: store.events.length + 1,
        event_type: 'outreach',
        from_state: null,
        to_state: null,
        detail: { channel: row.channel, outcome: row.outcome, note: row.note },
        created_at: row.attempted_at,
      });
      return ok({ ok: true, outreach: row });
    }

    case 'POST /api/explain': {
      const language = (['en', 'ar', 'hi'].includes(String(body.language)) ? body.language : 'en') as Language;
      return ok({
        text: explainTemplate({ instrument: 'PHQ9', total: DEMO_TOTAL, band: 'moderate', language }),
        source: 'template',
      });
    }

    case `GET /api/residents/${DEMO_RESIDENT_ID}/cases`:
      return ok({
        cases: [
          {
            id: DEMO_CASE_ID,
            risk_tier: 'moderate',
            state: store.state,
            created_at: iso(0),
            instrument: 'PHQ9',
            total_score: DEMO_TOTAL,
          },
        ],
        consentRequired: false,
      });

    case `GET /api/residents/${DEMO_RESIDENT_ID}/consent`:
      return ok({
        resident: { id: DEMO_RESIDENT_ID, pseudo_id: DEMO_PSEUDO_ID },
        scopes: CONSENT_SCOPES.map((scope) => ({ scope, granted: store.consent[scope], updated_at: iso(0) })),
        audit: store.audit,
      });

    case `POST /api/residents/${DEMO_RESIDENT_ID}/consent`: {
      const scope = String(body.scope);
      if (!CONSENT_SCOPES.includes(scope as (typeof CONSENT_SCOPES)[number])) {
        return { status: 400, body: { error: 'Unknown scope' } };
      }
      const granted = Boolean(body.granted);
      store.consent[scope] = granted;
      store.audit.unshift({ scope, action: granted ? 'granted' : 'revoked', actor: 'resident', created_at: demoNow(store) });
      return ok({ ok: true });
    }

    case 'GET /api/navigator/queue': {
      const s = sla(store);
      return ok({
        cases: [
          {
            id: DEMO_CASE_ID,
            pseudo_id: DEMO_PSEUDO_ID,
            risk_tier: 'moderate',
            state: store.state,
            instrument: 'PHQ9',
            total_score: DEMO_TOTAL,
            next_milestone: s.next_milestone,
            next_due: s.next_due,
            is_overdue: s.is_overdue,
            overdue_by: s.overdue_by,
            created_at: iso(0),
          },
        ],
        clock: clock(store),
      });
    }

    case 'GET /api/demo/clock':
      return ok(clock(store));

    case 'POST /api/demo/clock': {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        return { status: 400, body: { error: 'days must be an integer 1-30' } };
      }
      store.day += days;
      return ok(clock(store));
    }

    case 'GET /api/gapfinder':
      return ok(GAPFINDER);

    default:
      return {
        status: 503,
        body: { error: 'This area is not part of the demo story. Reset the demo to use live data.' },
      };
  }
}