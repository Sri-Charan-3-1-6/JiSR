import { explainTemplate, type Language } from '@/lib/explain';
import { nextState, type CaseState } from '@/lib/matching';
import { DEFAULT_PREFS, decide, snoozedDue, type ReminderPrefs } from '@/lib/reminders';
import { buildContactMessage, containsHealthData, waLink } from '@/lib/trusted-contact';

// The demo story runs entirely on these seeded fixtures. While demo mode is
// active the provider intercepts every /api/ request and answers it from this
// store, so the story never touches the live backend.
export const DEMO_CASE_ID = 'demo-case';
export const DEMO_RESIDENT_ID = 'demo-resident';
export const DEMO_PSEUDO_ID = 'JISR-DEMO-099';
export const DEMO_CONTACT_ID = 'demo-contact';
export const DEMO_TASK_ID = 'demo-task';
const DEMO_CHECKIN_MISSED = 'demo-checkin-missed';
const DEMO_CHECKIN_PENDING = 'demo-checkin-pending';
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
  { route: '/resident/checkin', day: DEMO_MISSED_DAY },
  { route: '/resident/trusted-contact' },
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

interface DemoCheckin {
  id: string;
  state: string;
  due_at: string;
  reminders_sent: number;
  consecutive_misses: number;
  missed_at: string | null;
  completed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

interface DemoReminderEvent {
  id: number;
  checkin_id: string | null;
  kind: string;
  note: string | null;
  read_at: string | null;
  created_at: string;
}

interface DemoTask {
  id: string;
  resident_id: string;
  case_id: string;
  kind: string;
  reason: string;
  consecutive_misses: number;
  call_outcome: 'reached' | 'not_reached' | null;
  call_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface DemoContact {
  id: string;
  contact_label: string;
  contact_phone: string;
  created_at: string;
  updated_at: string;
}

interface DemoContactEvent {
  id: number;
  task_id: string | null;
  kind: 'simulated_sent' | 'contact_made';
  message: string | null;
  created_at: string;
}

interface DemoCalmLine {
  id: string;
  language: string;
  kind: 'support' | 'joke';
  exercise: string | null;
  body: string;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const CONSENT_SCOPES = [
  'store_results',
  'share_with_primary_care',
  'anonymous_aggregate_stats',
  'wearable_signal',
  'navigator_contact',
  'reminders',
  'trusted_contact',
] as const;

export interface DemoStore {
  day: number;
  state: CaseState;
  events: DemoEvent[];
  outreach: DemoOutreach[];
  consent: Record<string, boolean>;
  audit: Array<{ scope: string; action: string; actor: string; created_at: string }>;
  prefs: ReminderPrefs;
  checkins: DemoCheckin[];
  reminderEvents: DemoReminderEvent[];
  tasks: DemoTask[];
  contact: DemoContact | null;
  contactEvents: DemoContactEvent[];
  jokesOptIn: boolean;
  calmLines: DemoCalmLine[];
  calmSessions: Array<{ id: number; exercise: string; seconds: number; completed: boolean; created_at: string }>;
  companionSessions: Array<{ id: number; steps: number; outcome: string; crisis_flag: boolean; created_at: string }>;
  seq: number;
}

// Pre-written supportive lines (never AI-generated). Jokes are opt-in.
const CALM_LINES: DemoCalmLine[] = [
  { id: 'cl-en-1', language: 'en', kind: 'support', exercise: 'breathing', body: "It's okay to take this one breath at a time.", reviewed: true, reviewed_by: 'faculty', reviewed_at: null },
  { id: 'cl-en-2', language: 'en', kind: 'support', exercise: null, body: "You don't have to figure everything out right now.", reviewed: true, reviewed_by: 'faculty', reviewed_at: null },
  { id: 'cl-en-3', language: 'en', kind: 'support', exercise: 'grounding', body: 'Notice one thing around you that feels steady.', reviewed: false, reviewed_by: null, reviewed_at: null },
  { id: 'cl-en-j', language: 'en', kind: 'joke', exercise: null, body: 'Why did the scarecrow win an award? Because he was outstanding in his field.', reviewed: false, reviewed_by: null, reviewed_at: null },
  { id: 'cl-ar-1', language: 'ar', kind: 'support', exercise: 'breathing', body: 'لا بأس أن تأخذ كل نفس على حدة.', reviewed: true, reviewed_by: 'faculty', reviewed_at: null },
  { id: 'cl-ar-2', language: 'ar', kind: 'support', exercise: null, body: 'ليس عليك حل كل شيء الآن.', reviewed: false, reviewed_by: null, reviewed_at: null },
  { id: 'cl-ar-j', language: 'ar', kind: 'joke', exercise: null, body: 'لماذا فاز الفزاعة بجائزة؟ لأنه كان بارزًا في حقله.', reviewed: false, reviewed_by: null, reviewed_at: null },
  { id: 'cl-hi-1', language: 'hi', kind: 'support', exercise: 'breathing', body: 'एक-एक साँस लेना ठीक है।', reviewed: true, reviewed_by: 'faculty', reviewed_at: null },
  { id: 'cl-hi-2', language: 'hi', kind: 'support', exercise: null, body: 'अभी सब कुछ सुलझाना ज़रूरी नहीं है।', reviewed: false, reviewed_by: null, reviewed_at: null },
  { id: 'cl-hi-j', language: 'hi', kind: 'joke', exercise: null, body: 'सूरज मुखी क्यों मुस्कुराया? क्योंकि उसे अपना दिन मिल गया!', reviewed: false, reviewed_by: null, reviewed_at: null },
];

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
    prefs: { ...DEFAULT_PREFS },
    checkins: [
      {
        id: DEMO_CHECKIN_MISSED,
        state: 'missed',
        due_at: iso(DEMO_MISSED_DAY),
        reminders_sent: 3,
        consecutive_misses: 3,
        missed_at: iso(DEMO_MISSED_DAY),
        completed_at: null,
        snoozed_until: null,
        created_at: iso(DEMO_MISSED_DAY - 1),
      },
      {
        id: DEMO_CHECKIN_PENDING,
        state: 'pending',
        due_at: iso(DEMO_MISSED_DAY),
        reminders_sent: 0,
        consecutive_misses: 0,
        missed_at: null,
        completed_at: null,
        snoozed_until: null,
        created_at: iso(DEMO_MISSED_DAY),
      },
    ],
    reminderEvents: [
      { id: 101, checkin_id: DEMO_CHECKIN_MISSED, kind: 'reminder', note: 'Check-in reminder.', read_at: iso(11), created_at: iso(11) },
      { id: 102, checkin_id: DEMO_CHECKIN_MISSED, kind: 'soft_reminder', note: 'Gentle second reminder.', read_at: iso(11), created_at: iso(11, 7_200_000) },
      { id: 103, checkin_id: DEMO_CHECKIN_MISSED, kind: 'missed', note: 'Check-in missed.', read_at: iso(12), created_at: iso(12) },
      { id: 104, checkin_id: DEMO_CHECKIN_MISSED, kind: 'escalated', note: '3 consecutive missed check-ins', read_at: iso(12), created_at: iso(12, 60_000) },
      { id: 105, checkin_id: DEMO_CHECKIN_MISSED, kind: 'stopped', note: 'Reminder ladder stopped after escalation.', read_at: iso(12), created_at: iso(12, 120_000) },
    ],
    tasks: [
      {
        id: DEMO_TASK_ID,
        resident_id: DEMO_RESIDENT_ID,
        case_id: DEMO_CASE_ID,
        kind: 'checkin_escalation',
        reason: '3 consecutive missed check-ins',
        consecutive_misses: 3,
        call_outcome: 'not_reached',
        call_note: 'Synthetic demo call — no answer.',
        resolved_at: null,
        created_at: iso(DEMO_MISSED_DAY, 60_000),
      },
    ],
    contact: {
      id: DEMO_CONTACT_ID,
      contact_label: 'Sister',
      contact_phone: '971500000000',
      created_at: iso(0),
      updated_at: iso(0),
    },
    contactEvents: [],
    jokesOptIn: false,
    calmLines: CALM_LINES.map((l) => ({ ...l })),
    calmSessions: [],
    companionSessions: [],
    seq: 200,
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

function nextId(store: DemoStore): number {
  return ++store.seq;
}

function addReminderEvent(store: DemoStore, checkinId: string | null, kind: string, note: string | null): DemoReminderEvent {
  const row: DemoReminderEvent = {
    id: nextId(store),
    checkin_id: checkinId,
    kind,
    note,
    read_at: null,
    created_at: demoNow(store),
  };
  store.reminderEvents.unshift(row);
  return row;
}

// Mirrors the live evaluate route: bounded ladder, quiet hours, daily cap.
function evaluate(store: DemoStore): { events: DemoReminderEvent[]; tasks: DemoTask[] } {
  const now = new Date(demoNow(store));
  const prefs = store.prefs;
  const dayKey = demoNow(store).slice(0, 10);
  let sentToday = store.reminderEvents.filter(
    (e) => (e.kind === 'reminder' || e.kind === 'soft_reminder') && e.created_at.slice(0, 10) === dayKey,
  ).length;

  const events: DemoReminderEvent[] = [];
  const tasks: DemoTask[] = [];
  const open = store.checkins
    .filter((c) => ['pending', 'snoozed', 'missed'].includes(c.state))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  for (const row of open) {
    const { action, missed } = decide(
      {
        state: row.state,
        dueAt: new Date(row.due_at),
        remindersSent: row.reminders_sent,
        consecutiveMisses: row.consecutive_misses,
        snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until) : null,
      },
      prefs,
      now,
      sentToday,
    );
    if (action === 'wait') continue;
    if (action === 'skip_quiet') {
      events.push(addReminderEvent(store, row.id, 'skipped_quiet_hours', 'Quiet hours — no reminder sent.'));
      continue;
    }
    if (action === 'skip_cap') {
      events.push(addReminderEvent(store, row.id, 'skipped_daily_cap', 'Daily reminder limit reached.'));
      continue;
    }
    if (action === 'reminder') {
      row.reminders_sent += 1;
      events.push(addReminderEvent(store, row.id, 'reminder', 'Check-in reminder.'));
      sentToday++;
      continue;
    }
    if (action === 'soft_reminder' && missed) {
      const prev = store.checkins
        .filter((c) => c.id !== row.id && c.due_at < row.due_at && ['missed', 'stopped', 'completed'].includes(c.state))
        .sort((a, b) => b.due_at.localeCompare(a.due_at))[0];
      const streak = (prev?.missed_at ? prev.consecutive_misses : 0) + 1;
      row.state = 'missed';
      row.missed_at = demoNow(store);
      row.consecutive_misses = streak;
      row.reminders_sent += 1;
      events.push(addReminderEvent(store, row.id, 'missed', 'Check-in missed.'));
      events.push(addReminderEvent(store, row.id, 'soft_reminder', 'Gentle second reminder.'));
      sentToday++;
      continue;
    }
    if (action === 'escalate') {
      const openTask = store.tasks.find((t) => t.kind === 'checkin_escalation' && !t.resolved_at);
      if (openTask) {
        row.state = 'stopped';
        events.push(addReminderEvent(store, row.id, 'stopped', 'A navigator task is already open.'));
        continue;
      }
      const reason = `${row.consecutive_misses} consecutive missed check-ins`;
      const task: DemoTask = {
        id: `demo-task-${nextId(store)}`,
        resident_id: DEMO_RESIDENT_ID,
        case_id: DEMO_CASE_ID,
        kind: 'checkin_escalation',
        reason,
        consecutive_misses: row.consecutive_misses,
        call_outcome: null,
        call_note: null,
        resolved_at: null,
        created_at: demoNow(store),
      };
      store.tasks.unshift(task);
      tasks.push(task);
      row.state = 'stopped';
      row.reminders_sent += 1;
      events.push(addReminderEvent(store, row.id, 'escalated', reason));
      events.push(addReminderEvent(store, row.id, 'stopped', 'Reminder ladder stopped after escalation.'));
      continue;
    }
    row.state = 'stopped';
    events.push(addReminderEvent(store, row.id, 'stopped', 'Reminder ladder stopped after its limit.'));
  }
  return { events, tasks };
}

function taskWithContact(store: DemoStore, t: DemoTask) {
  const available = Boolean(store.consent.trusted_contact && store.contact);
  return {
    ...t,
    pseudo_id: DEMO_PSEUDO_ID,
    language: 'hi',
    contact_id: available ? store.contact!.id : null,
    contact_label: available ? store.contact!.contact_label : null,
    contact_phone: available ? store.contact!.contact_phone : null,
    contact_available: available,
  };
}

function eligibleTask(store: DemoStore): DemoTask | null {
  if (!store.consent.trusted_contact) return null;
  return (
    store.tasks
      .filter((t) => t.kind === 'checkin_escalation' && t.call_outcome === 'not_reached' && !t.resolved_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
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
  checkin: {
    metrics: {
      checkins_total: '180',
      completed_total: '126',
      missed_total: '54',
      completion_rate: '0.70',
      median_hours_to_reengage: '30.5',
      escalations_total: '20',
      escalations_resolved_human: '12',
      escalations_human_share: '0.60',
    },
    fairness: [
      { dimension: 'language', group_value: 'ar', n: '60', completion_rate: '0.78', median_hours_to_reengage: '28', best_completion_rate: '0.78', is_gap: false },
      { dimension: 'language', group_value: 'en', n: '70', completion_rate: '0.78', median_hours_to_reengage: '26', best_completion_rate: '0.78', is_gap: false },
      { dimension: 'language', group_value: 'hi', n: '50', completion_rate: '0.52', median_hours_to_reengage: '40', best_completion_rate: '0.78', is_gap: true },
      { dimension: 'age_band', group_value: '18-24', n: '60', completion_rate: '0.68', median_hours_to_reengage: '32', best_completion_rate: '0.74', is_gap: false },
      { dimension: 'age_band', group_value: '25-34', n: '70', completion_rate: '0.74', median_hours_to_reengage: '29', best_completion_rate: '0.74', is_gap: false },
      { dimension: 'age_band', group_value: '35-44', n: '50', completion_rate: '0.70', median_hours_to_reengage: '31', best_completion_rate: '0.74', is_gap: false },
      { dimension: 'gender', group_value: 'female', n: '95', completion_rate: '0.72', median_hours_to_reengage: '30', best_completion_rate: '0.72', is_gap: false },
      { dimension: 'gender', group_value: 'male', n: '85', completion_rate: '0.68', median_hours_to_reengage: '31', best_completion_rate: '0.72', is_gap: false },
      { dimension: 'nationality', group_value: 'Group A', n: '65', completion_rate: '0.73', median_hours_to_reengage: '29', best_completion_rate: '0.73', is_gap: false },
      { dimension: 'nationality', group_value: 'Group B', n: '60', completion_rate: '0.70', median_hours_to_reengage: '30', best_completion_rate: '0.73', is_gap: false },
      { dimension: 'nationality', group_value: 'Group C', n: '55', completion_rate: '0.66', median_hours_to_reengage: '33', best_completion_rate: '0.73', is_gap: false },
      { dimension: 'area', group_value: 'Area 1', n: '60', completion_rate: '0.72', median_hours_to_reengage: '29', best_completion_rate: '0.72', is_gap: false },
      { dimension: 'area', group_value: 'Area 2', n: '60', completion_rate: '0.70', median_hours_to_reengage: '30', best_completion_rate: '0.72', is_gap: false },
      { dimension: 'area', group_value: 'Area 3', n: '60', completion_rate: '0.68', median_hours_to_reengage: '32', best_completion_rate: '0.72', is_gap: false },
    ],
    suppressed: [{ dimension: 'nationality', group_value: 'Group D' }],
    companion: { sessions_total: '40', heavy_total: '10', heavy_share: '0.25', crisis_sessions: '2' },
  },
};

export interface DemoResponse {
  status: number;
  body: unknown;
}

const ok = (body: unknown): DemoResponse => ({ status: 200, body });
const consent403 = (scope: string): DemoResponse => ({
  status: 403,
  body: { error: `${scope} consent required`, consentRequired: true },
});

export function handleDemoRequest(
  path: string,
  init: { method?: string; body?: string | null },
  store: DemoStore,
): DemoResponse {
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  const clean = path.split('?')[0];
  const route = `${method} ${clean}`;
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  const R = DEMO_RESIDENT_ID;

  // ---- Layer 5 dynamic-id routes ----
  const completeMatch = clean.match(/^\/api\/checkins\/([^/]+)\/complete$/);
  if (method === 'POST' && completeMatch) {
    if (!store.consent.reminders) return consent403('reminders');
    const c = store.checkins.find((x) => x.id === completeMatch[1]);
    if (!c) return { status: 404, body: { error: 'Check-in not found' } };
    c.state = 'completed';
    c.completed_at = demoNow(store);
    c.consecutive_misses = 0;
    c.snoozed_until = null;
    addReminderEvent(store, c.id, 'completed', null);
    return ok({ ok: true, checkin: c });
  }

  const snoozeMatch = clean.match(/^\/api\/checkins\/([^/]+)\/snooze$/);
  if (method === 'POST' && snoozeMatch) {
    if (!store.consent.reminders) return consent403('reminders');
    const c = store.checkins.find((x) => x.id === snoozeMatch[1]);
    if (!c) return { status: 404, body: { error: 'Check-in not found' } };
    if (c.state !== 'pending' && c.state !== 'snoozed') {
      return { status: 400, body: { error: 'Only open check-ins can be snoozed' } };
    }
    const minutes = Number(body.minutes ?? store.prefs.snoozeMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) {
      return { status: 400, body: { error: 'minutes must be an integer 5-240' } };
    }
    const due = snoozedDue(new Date(demoNow(store)), minutes).toISOString();
    c.state = 'snoozed';
    c.snoozed_until = due;
    c.due_at = due;
    addReminderEvent(store, c.id, 'snoozed', `Snoozed ${minutes} minutes.`);
    return ok({ ok: true, checkin: c });
  }

  const readMatch = clean.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (method === 'POST' && readMatch) {
    if (!store.consent.reminders) return consent403('reminders');
    const e = store.reminderEvents.find((x) => String(x.id) === readMatch[1]);
    if (!e) return { status: 404, body: { error: 'Notification not found' } };
    e.read_at = demoNow(store);
    return ok({ ok: true });
  }

  const callMatch = clean.match(/^\/api\/navigator\/tasks\/([^/]+)\/call$/);
  if (method === 'POST' && callMatch) {
    const outcome = String(body.outcome ?? '');
    if (!['reached', 'not_reached'].includes(outcome)) {
      return { status: 400, body: { error: 'outcome must be reached or not_reached' } };
    }
    const t = store.tasks.find((x) => x.id === callMatch[1]);
    if (!t) return { status: 404, body: { error: 'Task not found' } };
    t.call_outcome = outcome as 'reached' | 'not_reached';
    t.call_note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
    t.resolved_at = outcome === 'reached' ? demoNow(store) : null;
    return ok({ task: t, contactEligible: outcome === 'not_reached' && Boolean(store.consent.trusted_contact && store.contact) });
  }

  const sendMatch = clean.match(/^\/api\/trusted-contact\/([^/]+)\/send$/);
  if (method === 'POST' && sendMatch) {
    if (!store.contact || store.contact.id !== sendMatch[1]) {
      return { status: 404, body: { error: 'Contact not found' } };
    }
    if (!store.consent.trusted_contact) return consent403('trusted_contact');
    const task = eligibleTask(store);
    if (!task) return { status: 403, body: { error: 'A navigator human call must fail before any contact message' } };
    if (store.contactEvents.some((e) => e.task_id === task.id && e.kind === 'simulated_sent')) {
      return { status: 409, body: { error: 'A message was already sent for this task' } };
    }
    const message = buildContactMessage(DEMO_PSEUDO_ID);
    if (containsHealthData(message)) return { status: 500, body: { error: 'Message failed the health-data guard' } };
    const event: DemoContactEvent = { id: nextId(store), task_id: task.id, kind: 'simulated_sent', message, created_at: demoNow(store) };
    store.contactEvents.unshift(event);
    return ok({ message, waLink: waLink(store.contact.contact_phone, message), simulated: true, taskId: task.id, event });
  }

  const replyMatch = clean.match(/^\/api\/trusted-contact\/([^/]+)\/reply$/);
  if (method === 'POST' && replyMatch) {
    if (!store.contact || store.contact.id !== replyMatch[1]) {
      return { status: 404, body: { error: 'Contact not found' } };
    }
    if (!store.consent.trusted_contact) return consent403('trusted_contact');
    const sent = store.contactEvents.find((e) => e.kind === 'simulated_sent');
    if (!sent) return { status: 400, body: { error: 'No simulated message to reply to' } };
    const event: DemoContactEvent = { id: nextId(store), task_id: sent.task_id, kind: 'contact_made', message: 'Reply recorded: contact made.', created_at: demoNow(store) };
    store.contactEvents.unshift(event);
    if (sent.task_id) {
      const t = store.tasks.find((x) => x.id === sent.task_id);
      if (t && !t.resolved_at) t.resolved_at = demoNow(store);
    }
    return ok({ ok: true, kind: 'contact_made', event });
  }

  const lineMatch = clean.match(/^\/api\/calm\/lines\/([^/]+)$/);
  if (method === 'PATCH' && lineMatch) {
    const line = store.calmLines.find((l) => l.id === lineMatch[1]);
    if (!line) return { status: 404, body: { error: 'Line not found' } };
    line.reviewed = Boolean(body.reviewed);
    line.reviewed_by = line.reviewed ? 'faculty' : null;
    line.reviewed_at = line.reviewed ? demoNow(store) : null;
    return ok({ line });
  }

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

    case `GET /api/residents/${R}/cases`:
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

    case `GET /api/residents/${R}/consent`:
      return ok({
        resident: { id: DEMO_RESIDENT_ID, pseudo_id: DEMO_PSEUDO_ID },
        scopes: CONSENT_SCOPES.map((scope) => ({ scope, granted: store.consent[scope], updated_at: iso(0) })),
        audit: store.audit,
      });

    case `POST /api/residents/${R}/consent`: {
      const scope = String(body.scope);
      if (!CONSENT_SCOPES.includes(scope as (typeof CONSENT_SCOPES)[number])) {
        return { status: 400, body: { error: 'Unknown scope' } };
      }
      const granted = Boolean(body.granted);
      store.consent[scope] = granted;
      store.audit.unshift({ scope, action: granted ? 'granted' : 'revoked', actor: 'resident', created_at: demoNow(store) });
      return ok({ ok: true });
    }

    case `GET /api/residents/${R}/reminder-prefs`:
      return ok({ prefs: store.prefs, consent: Boolean(store.consent.reminders), defaults: DEFAULT_PREFS });

    case `PUT /api/residents/${R}/reminder-prefs`: {
      if (!store.consent.reminders) return consent403('reminders');
      store.prefs = { ...DEFAULT_PREFS, ...store.prefs, ...(body as Partial<ReminderPrefs>) };
      return ok({ prefs: store.prefs, saved: true });
    }

    case `GET /api/residents/${R}/checkins`:
      if (!store.consent.reminders) return ok({ checkins: [], consentRequired: true });
      return ok({ checkins: [...store.checkins].sort((a, b) => b.due_at.localeCompare(a.due_at)) });

    case `POST /api/residents/${R}/checkins/evaluate`: {
      if (!store.consent.reminders) return consent403('reminders');
      return ok(evaluate(store));
    }

    case `GET /api/residents/${R}/notifications`: {
      if (!store.consent.reminders) return ok({ events: [], unread: 0, consentRequired: true });
      const events = [...store.reminderEvents].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
      return ok({ events, unread: events.filter((e) => !e.read_at).length });
    }

    case `GET /api/residents/${R}/audit`: {
      const store5 = Boolean(store.consent.store_results);
      return ok({
        consent: store.audit,
        reminders: store.consent.reminders ? store.reminderEvents : [],
        contact: store.consent.trusted_contact ? store.contactEvents : [],
        calm: store5 ? store.calmSessions : [],
        companion: store5 ? store.companionSessions : [],
      });
    }

    case `GET /api/residents/${R}/companion-prefs`:
      return ok({ jokesOptIn: store.jokesOptIn });

    case `PUT /api/residents/${R}/companion-prefs`:
      store.jokesOptIn = Boolean(body.jokesOptIn);
      return ok({ jokesOptIn: store.jokesOptIn });

    case 'POST /api/companion/sessions': {
      if (!store.consent.store_results) return consent403('store_results');
      const row = {
        id: nextId(store),
        steps: Number(body.steps) || 0,
        outcome: String(body.outcome ?? ''),
        crisis_flag: Boolean(body.crisisFlag),
        created_at: demoNow(store),
      };
      store.companionSessions.unshift(row);
      return ok({ ok: true });
    }

    case 'GET /api/calm/lines': {
      const language = query.get('language') ?? 'en';
      if (!['en', 'ar', 'hi'].includes(language)) {
        return { status: 400, body: { error: 'language must be en, ar or hi' } };
      }
      const review = query.get('review') === '1';
      const wantsJokes = query.get('jokes') === '1';
      const includeJokes = wantsJokes && (review || store.jokesOptIn);
      const exercise = query.get('exercise');
      let lines = store.calmLines.filter((l) => l.language === language);
      if (!includeJokes) lines = lines.filter((l) => l.kind === 'support');
      if (exercise && ['breathing', 'grounding', 'memory'].includes(exercise)) {
        lines = lines.filter((l) => l.exercise === exercise || l.exercise === null);
      }
      lines = [...lines].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
      return ok({ lines });
    }

    case 'POST /api/calm/sessions': {
      if (!store.consent.store_results) return consent403('store_results');
      const row = {
        id: nextId(store),
        exercise: String(body.exercise ?? ''),
        seconds: Number(body.seconds) || 0,
        completed: Boolean(body.completed),
        created_at: demoNow(store),
      };
      store.calmSessions.unshift(row);
      return ok({ ok: true });
    }

    case `GET /api/residents/${R}/trusted-contact`: {
      const granted = Boolean(store.consent.trusted_contact);
      return ok({
        contact: granted ? store.contact : null,
        consent: granted,
        eligibleTask: granted ? eligibleTask(store) : null,
        events: granted ? store.contactEvents : [],
      });
    }

    case `PUT /api/residents/${R}/trusted-contact`: {
      if (!store.consent.trusted_contact) return consent403('trusted_contact');
      const label = String(body.contactLabel ?? '').trim();
      const phone = String(body.contactPhone ?? '').replace(/\D/g, '');
      if (!label || label.length > 40 || phone.length < 7 || phone.length > 15) {
        return { status: 400, body: { error: 'A label and a valid phone number are required' } };
      }
      store.contact = {
        id: store.contact?.id ?? DEMO_CONTACT_ID,
        contact_label: label,
        contact_phone: phone,
        created_at: store.contact?.created_at ?? demoNow(store),
        updated_at: demoNow(store),
      };
      return ok({ contact: store.contact });
    }

    case `DELETE /api/residents/${R}/trusted-contact`:
      store.contact = null;
      return ok({ ok: true });

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
        tasks: store.tasks.filter((t) => !t.resolved_at).map((t) => taskWithContact(store, t)),
      });
    }

    case 'GET /api/navigator/tasks':
      return ok({ tasks: store.tasks.map((t) => taskWithContact(store, t)) });

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