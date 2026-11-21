// Layer 5 integration tests against a REAL Postgres (Supabase).
// Handler-level tests call the route handlers directly with one persistent
// SYNTHETIC fixture resident (JISR-T5-0001, idempotent upserts — no DELETE).
// RLS tests run inside BEGIN ... ROLLBACK with SET ROLE jisr_app.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { Pool } from 'pg';
import { DEFAULT_PREFS } from '@/lib/reminders';
import { buildContactMessage, containsHealthData } from '@/lib/trusted-contact';

import { GET as prefsGET, PUT as prefsPUT } from '@/app/api/residents/[id]/reminder-prefs/route';
import { GET as checkinsGET, POST as checkinsPOST } from '@/app/api/residents/[id]/checkins/route';
import { POST as evaluatePOST } from '@/app/api/residents/[id]/checkins/evaluate/route';
import { POST as completePOST } from '@/app/api/checkins/[id]/complete/route';
import { POST as snoozePOST } from '@/app/api/checkins/[id]/snooze/route';
import { GET as notificationsGET } from '@/app/api/residents/[id]/notifications/route';
import { GET as auditGET } from '@/app/api/residents/[id]/audit/route';
import { GET as linesGET } from '@/app/api/calm/lines/route';
import { PATCH as linePATCH } from '@/app/api/calm/lines/[id]/route';
import { POST as calmSessionsPOST } from '@/app/api/calm/sessions/route';
import { POST as companionSessionsPOST } from '@/app/api/companion/sessions/route';
import { GET as contactGET, PUT as contactPUT } from '@/app/api/residents/[id]/trusted-contact/route';
import { POST as sendPOST } from '@/app/api/trusted-contact/[id]/send/route';
import { POST as replyPOST } from '@/app/api/trusted-contact/[id]/reply/route';
import { POST as callPOST } from '@/app/api/navigator/tasks/[id]/call/route';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr';
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  max: 2,
});

const SCOPES = [
  'store_results', 'share_with_primary_care', 'anonymous_aggregate_stats',
  'wearable_signal', 'navigator_contact', 'reminders', 'trusted_contact',
];

let rid = '';

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/test', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (res: Response) => ({ status: res.status, body: await res.json() });

async function setScope(scope: string, granted: boolean) {
  await pool.query(
    `insert into consent_scopes (resident_id, scope, granted, updated_at)
     values ($1, $2, $3, sim_now())
     on conflict (resident_id, scope) do update set granted = $3, updated_at = sim_now()`,
    [rid, scope, granted],
  );
}

async function setPrefs(patch: Partial<typeof DEFAULT_PREFS>) {
  const p = { ...DEFAULT_PREFS, ...patch };
  await pool.query(
    `insert into reminder_prefs
       (resident_id, remind_at, quiet_start, quiet_end, max_per_day, snooze_minutes,
        ladder_gap_minutes, ladder_miss_limit, vibration, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,sim_now())
     on conflict (resident_id) do update set
       remind_at=$2, quiet_start=$3, quiet_end=$4, max_per_day=$5, snooze_minutes=$6,
       ladder_gap_minutes=$7, ladder_miss_limit=$8, vibration=$9, updated_at=sim_now()`,
    [rid, p.remindAt, p.quietStart, p.quietEnd, p.maxPerDay, p.snoozeMinutes,
     p.ladderGapMinutes, p.ladderMissLimit, p.vibration],
  );
}

async function newCheckin(due: Date): Promise<string> {
  const r = await pool.query(
    `insert into checkins (resident_id, due_at, created_at) values ($1,$2,sim_now()) returning id`,
    [rid, due],
  );
  return r.rows[0].id as string;
}

async function eventsFor(checkinId: string) {
  const r = await pool.query(
    `select kind from reminder_events where checkin_id = $1 order by id`,
    [checkinId],
  );
  return r.rows.map((x) => x.kind as string);
}

async function checkinState(id: string) {
  const r = await pool.query(
    `select state, reminders_sent, consecutive_misses from checkins where id = $1`,
    [id],
  );
  return r.rows[0] as { state: string; reminders_sent: number; consecutive_misses: number };
}

const hhmm = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

beforeAll(async () => {
  const r = await pool.query(
    `insert into residents (pseudo_id, language, age_band, gender, nationality, area)
     values ('JISR-T5-0001','en','25-34','female','Group T5','Area T5')
     on conflict (pseudo_id) do update set language = 'en' returning id`,
  );
  rid = r.rows[0].id as string;
  await pool.query(
    `insert into consent_scopes (resident_id, scope, granted)
     select $1, s.scope, false from unnest($2::text[]) as s(scope)
     on conflict (resident_id, scope) do update set granted = false`,
    [rid, SCOPES],
  );
}, 30000);

beforeEach(async () => {
  // Non-destructive fixture reset (UPDATEs only, never DELETE): close out
  // prior check-ins so streaks and the daily send count start fresh on every
  // run, resolve open tasks, revoke all scopes, restore default preferences.
  // Age ALL fixture check-ins so they can never be the "previous" check-in
  // for a new fixture (streak logic looks at the latest due before the current
  // one, and a completed check-in between two misses breaks the streak).
  await pool.query(
    `update checkins set state = 'completed', completed_at = sim_now(), consecutive_misses = 0,
            missed_at = null, due_at = sim_now() - interval '30 days'
     where resident_id = $1`,
    [rid],
  );
  await pool.query(
    `update reminder_events set kind = 'completed'
     where resident_id = $1 and kind in ('reminder','soft_reminder')
       and created_at::date = sim_now()::date`,
    [rid],
  );
  await pool.query(
    `update navigator_tasks set resolved_at = sim_now()
     where resident_id = $1 and resolved_at is null`,
    [rid],
  );
  await pool.query(
    `insert into consent_scopes (resident_id, scope, granted)
     select $1, s.scope, false from unnest($2::text[]) as s(scope)
     on conflict (resident_id, scope) do update set granted = false`,
    [rid, SCOPES],
  );
  await pool.query(
    `insert into companion_prefs (resident_id, jokes_opt_in) values ($1, false)
     on conflict (resident_id) do update set jokes_opt_in = false`,
    [rid],
  );
  await setPrefs({});
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe('reminder preferences and consent gates', () => {
  it('refuses to save preferences without reminders consent', async () => {
    const res = await json(await prefsPUT(req('PUT', DEFAULT_PREFS), ctx(rid)));
    expect(res.status).toBe(403);
    expect(res.body.consentRequired).toBe(true);
    const get = await json(await prefsGET(req('GET'), ctx(rid)));
    expect(get.body.consent).toBe(false);
  });

  it('saves the user-owned schedule once consent is granted', async () => {
    await setScope('reminders', true);
    const res = await json(await prefsPUT(req('PUT', { ...DEFAULT_PREFS, maxPerDay: 2 }), ctx(rid)));
    expect(res.status).toBe(200);
    expect(res.body.prefs.maxPerDay).toBe(2);
  });

  it('rejects out-of-range preferences', async () => {
    await setScope('reminders', true);
    const res = await json(await prefsPUT(req('PUT', { ...DEFAULT_PREFS, maxPerDay: 99 }), ctx(rid)));
    expect(res.status).toBe(400);
  });
});

describe('quiet hours and daily cap', () => {
  it('skips sends inside quiet hours without marking a miss', async () => {
    await setScope('reminders', true);
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    await setPrefs({
      quietStart: hhmm(new Date(now.getTime() - 3600_000)),
      quietEnd: hhmm(new Date(now.getTime() + 3600_000)),
    });
    const ci = await newCheckin(new Date(now.getTime() - 600_000));
    const res = await json(await evaluatePOST(req('POST'), ctx(rid)));
    expect(res.status).toBe(200);
    expect(res.body.events.some((e: { kind: string }) => e.kind === 'skipped_quiet_hours')).toBe(true);
    expect(await eventsFor(ci)).toEqual(['skipped_quiet_hours']);
    expect((await checkinState(ci)).state).toBe('pending');
  }, 30000);

  it('skips sends once the daily cap is reached', async () => {
    await setScope('reminders', true);
    await setPrefs({ maxPerDay: 1, quietStart: '00:00', quietEnd: '00:00' });
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    await pool.query(
      `insert into reminder_events (resident_id, kind, created_at) values ($1,'reminder',$2)`,
      [rid, now],
    );
    const ci = await newCheckin(new Date(now.getTime() - 600_000));
    const res = await json(await evaluatePOST(req('POST'), ctx(rid)));
    expect(res.body.events.some((e: { kind: string }) => e.kind === 'skipped_daily_cap')).toBe(true);
    expect((await checkinState(ci)).state).toBe('pending');
    expect((await checkinState(ci)).reminders_sent).toBe(0);
  }, 30000);
});

describe('persistence ladder stops after its limit', () => {
  it('reminder -> soft reminder -> stop, then nothing forever', async () => {
    await setScope('reminders', true);
    await setPrefs({ ladderGapMinutes: 15, ladderMissLimit: 3, maxPerDay: 10, quietStart: '00:00', quietEnd: '00:00' });
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    const ci = await newCheckin(new Date(now.getTime() - 40 * 60_000));

    await evaluatePOST(req('POST'), ctx(rid));
    expect((await checkinState(ci)).reminders_sent).toBe(1);
    await evaluatePOST(req('POST'), ctx(rid));
    expect((await checkinState(ci)).state).toBe('missed');
    await evaluatePOST(req('POST'), ctx(rid));
    expect((await checkinState(ci)).state).toBe('stopped');
    const before = await eventsFor(ci);
    expect(before).toEqual(['reminder', 'missed', 'soft_reminder', 'stopped']);
    await evaluatePOST(req('POST'), ctx(rid));
    await evaluatePOST(req('POST'), ctx(rid));
    expect(await eventsFor(ci)).toEqual(before);
  }, 60000);

  it('escalates to a navigator human task after N consecutive misses', async () => {
    await setScope('reminders', true);
    await setPrefs({ ladderGapMinutes: 15, ladderMissLimit: 2, maxPerDay: 10, quietStart: '00:00', quietEnd: '00:00' });
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    const a = await newCheckin(new Date(now.getTime() - 180 * 60_000));
    await evaluatePOST(req('POST'), ctx(rid));
    await evaluatePOST(req('POST'), ctx(rid));
    expect((await checkinState(a)).consecutive_misses).toBe(1);

    const b = await newCheckin(new Date(now.getTime() - 40 * 60_000));
    await evaluatePOST(req('POST'), ctx(rid));
    await evaluatePOST(req('POST'), ctx(rid));
    expect((await checkinState(b)).consecutive_misses).toBe(2);
    const res = await json(await evaluatePOST(req('POST'), ctx(rid)));
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].reason).toBe('2 consecutive missed check-ins');
    expect((await checkinState(b)).state).toBe('stopped');
    expect(await eventsFor(b)).toEqual(['reminder', 'missed', 'soft_reminder', 'escalated', 'stopped']);
  }, 60000);
});

describe('revoking consent stops everything immediately', () => {
  it('blocks evaluate, preferences and the notification feed', async () => {
    await setScope('reminders', true);
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    await newCheckin(new Date(now.getTime() - 600_000));
    await setScope('reminders', false);

    const ev = await json(await evaluatePOST(req('POST'), ctx(rid)));
    expect(ev.status).toBe(403);
    const put = await json(await prefsPUT(req('PUT', DEFAULT_PREFS), ctx(rid)));
    expect(put.status).toBe(403);
    const feed = await json(await notificationsGET(req('GET'), ctx(rid)));
    expect(feed.body.consentRequired).toBe(true);
    expect(feed.body.events).toEqual([]);
    const list = await json(await checkinsGET(req('GET'), ctx(rid)));
    expect(list.body.consentRequired).toBe(true);

    await setScope('reminders', true);
    const ev2 = await json(await evaluatePOST(req('POST'), ctx(rid)));
    expect(ev2.status).toBe(200);
  }, 30000);
});

describe('snooze and completion', () => {
  it('snoozes by the user preference and records completion', async () => {
    await setScope('reminders', true);
    const now = (await pool.query(`select sim_now() as t`)).rows[0].t as Date;
    const ci = await newCheckin(new Date(now.getTime() + 3600_000));
    const sn = await json(await snoozePOST(req('POST', { minutes: 30 }), ctx(ci)));
    expect(sn.status).toBe(200);
    expect(sn.body.checkin.state).toBe('snoozed');
    expect(await eventsFor(ci)).toContain('snoozed');
    const done = await json(await completePOST(req('POST'), ctx(ci)));
    expect(done.body.checkin.state).toBe('completed');
    expect(await eventsFor(ci)).toContain('completed');
    const again = await json(await snoozePOST(req('POST', { minutes: 30 }), ctx(ci)));
    expect(again.status).toBe(400);
  }, 30000);
});

describe('trusted contact: consent, failed-call precondition, message guard', () => {
  async function failedCallTask(): Promise<string> {
    const r = await pool.query(
      `insert into navigator_tasks (resident_id, kind, reason, consecutive_misses, call_outcome, created_at)
       values ($1,'checkin_escalation','3 consecutive missed check-ins',3,'not_reached',sim_now())
       returning id`,
      [rid],
    );
    return r.rows[0].id as string;
  }

  it('refuses contact setup and sends without consent', async () => {
    const put = await json(await contactPUT(req('PUT', { contactLabel: 'Sister', contactPhone: '971500000099' }), ctx(rid)));
    expect(put.status).toBe(403);
    await setScope('trusted_contact', true);
    await contactPUT(req('PUT', { contactLabel: 'Sister', contactPhone: '971500000099' }), ctx(rid));
    await setScope('trusted_contact', false);
    const get = await json(await contactGET(req('GET'), ctx(rid)));
    expect(get.body.consent).toBe(false);
    expect(get.body.contact).toBeNull();
  }, 30000);

  it('sends the generic simulated message only after a failed human call', async () => {
    await setScope('trusted_contact', true);
    const put = await json(await contactPUT(req('PUT', { contactLabel: 'Sister', contactPhone: '971500000099' }), ctx(rid)));
    const contactId = put.body.contact.id as string;

    const early = await json(await sendPOST(req('POST'), ctx(contactId)));
    expect(early.status).toBe(403);

    const taskId = await failedCallTask();
    const res = await json(await sendPOST(req('POST'), ctx(contactId)));
    expect(res.status).toBe(200);
    expect(res.body.simulated).toBe(true);
    expect(res.body.message).toBe(buildContactMessage('JISR-T5-0001'));
    expect(containsHealthData(res.body.message)).toBe(false);
    expect(res.body.waLink).toContain('https://wa.me/971500000099?text=');
    expect(res.body.taskId).toBe(taskId);

    const dup = await json(await sendPOST(req('POST'), ctx(contactId)));
    expect(dup.status).toBe(409);

    // A case exists; the reply must never change risk or state.
    const scr = await pool.query(
      `insert into screenings (resident_id, instrument, answers, total_score, band, created_at)
       values ($1,'PHQ9','[1,1,1,1,1,1,1,1,0]'::jsonb,8,'mild',sim_now()) returning id`,
      [rid],
    );
    await pool.query(
      `insert into cases (resident_id, screening_id, risk_tier, state, created_at)
       values ($1,$2,'moderate','SCREENED',sim_now())`,
      [rid, scr.rows[0].id],
    );
    const before = (await pool.query(`select risk_tier, state from cases where resident_id=$1 order by created_at desc limit 1`, [rid])).rows[0];

    const reply = await json(await replyPOST(req('POST'), ctx(contactId)));
    expect(reply.status).toBe(200);
    expect(reply.body.kind).toBe('contact_made');
    const after = (await pool.query(`select risk_tier, state from cases where resident_id=$1 order by created_at desc limit 1`, [rid])).rows[0];
    expect(after).toEqual(before);
    const task = (await pool.query(`select resolved_at, call_outcome from navigator_tasks where id=$1`, [taskId])).rows[0];
    expect(task.resolved_at).not.toBeNull();
    expect(task.call_outcome).toBe('not_reached');
  }, 60000);

  it('navigator call logging marks reached tasks resolved', async () => {
    const r = await pool.query(
      `insert into navigator_tasks (resident_id, kind, reason, consecutive_misses, created_at)
       values ($1,'checkin_escalation','3 consecutive missed check-ins',3,sim_now()) returning id`,
      [rid],
    );
    const res = await json(await callPOST(req('POST', { outcome: 'reached', note: 'Synthetic test call.' }), ctx(r.rows[0].id)));
    expect(res.status).toBe(200);
    expect(res.body.task.resolved_at).not.toBeNull();
    expect(res.body.contactEligible).toBe(false);
  }, 30000);
});

describe('calm corner, companion and the audit log', () => {
  it('gates session recording on store_results and never echoes mood tags', async () => {
    const denied = await json(await calmSessionsPOST(req('POST', { residentId: rid, exercise: 'breathing', seconds: 60, completed: true })));
    expect(denied.status).toBe(403);
    await setScope('store_results', true);
    const ok = await json(await calmSessionsPOST(req('POST', { residentId: rid, exercise: 'breathing', seconds: 60, completed: true })));
    expect(ok.status).toBe(200);
    const comp = await json(await companionSessionsPOST(req('POST', { residentId: rid, steps: 4, outcome: 'calm', moodTag: 'heavy', crisisFlag: false })));
    expect(comp.status).toBe(200);
    expect(comp.body.moodTag).toBeUndefined();

    await setScope('reminders', true);
    const audit = await json(await auditGET(req('GET'), ctx(rid)));
    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.reminders)).toBe(true);
    expect(audit.body.calm.length).toBeGreaterThan(0);
    expect(audit.body.companion.length).toBeGreaterThan(0);
    for (const row of audit.body.companion) expect(row.mood_tag).toBeUndefined();
  }, 30000);

  it('keeps jokes off by default and behind the opt-in', async () => {
    const linesUrl = (extra: string) =>
      new NextRequest(`http://localhost/api/calm/lines?language=en${extra}`);
    const off = await json(await linesGET(linesUrl(`&jokes=1&residentId=${rid}`)));
    expect(off.body.lines.every((l: { kind: string }) => l.kind === 'support')).toBe(true);
    await pool.query(
      `insert into companion_prefs (resident_id, jokes_opt_in) values ($1, true)
       on conflict (resident_id) do update set jokes_opt_in = true`,
      [rid],
    );
    const on = await json(await linesGET(linesUrl(`&jokes=1&residentId=${rid}`)));
    expect(on.body.lines.filter((l: { kind: string }) => l.kind === 'joke').length).toBe(3);
    await pool.query(
      `insert into companion_prefs (resident_id, jokes_opt_in) values ($1, false)
       on conflict (resident_id) do update set jokes_opt_in = false`,
      [rid],
    );
  }, 30000);

  it('lets faculty mark lines reviewed and unreviewed', async () => {
    const line = (await pool.query(`select id from calm_lines where language='en' and not reviewed limit 1`)).rows[0];
    const yes = await json(await linePATCH(req('PATCH', { reviewed: true, reviewedBy: 'faculty-test' }), ctx(String(line.id))));
    expect(yes.body.line.reviewed).toBe(true);
    expect(yes.body.line.reviewed_by).toBe('faculty-test');
    const no = await json(await linePATCH(req('PATCH', { reviewed: false }), ctx(String(line.id))));
    expect(no.body.line.reviewed).toBe(false);
    expect(no.body.line.reviewed_at).toBeNull();
  }, 30000);
});

describe('RLS and views (BEGIN ... ROLLBACK, SET ROLE jisr_app)', () => {
  it('reminders and trusted_contact scopes gate their tables; calm lines are public content', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      const r = await c.query(
        `insert into residents (pseudo_id, language) values ('JISR-T5-RLS','en') returning id`,
      );
      const id = r.rows[0].id;
      await c.query(`insert into checkins (resident_id, due_at) values ($1, sim_now())`, [id]);
      await c.query(`insert into trusted_contacts (resident_id, contact_label, contact_phone) values ($1,'Friend','971500000098')`, [id]);
      await c.query('set role jisr_app');
      expect((await c.query(`select count(*)::int as n from checkins where resident_id=$1`, [id])).rows[0].n).toBe(0);
      expect((await c.query(`select count(*)::int as n from trusted_contacts where resident_id=$1`, [id])).rows[0].n).toBe(0);
      expect((await c.query(`select count(*)::int as n from calm_lines`)).rows[0].n).toBeGreaterThan(0);
      await c.query('reset role');
      await c.query(`insert into consent_scopes (resident_id, scope, granted) values ($1,'reminders',true),($1,'trusted_contact',true)`, [id]);
      await c.query('set role jisr_app');
      expect((await c.query(`select count(*)::int as n from checkins where resident_id=$1`, [id])).rows[0].n).toBe(1);
      expect((await c.query(`select count(*)::int as n from trusted_contacts where resident_id=$1`, [id])).rows[0].n).toBe(1);
      await c.query('reset role');
      await c.query(`update consent_scopes set granted=false where resident_id=$1 and scope='reminders'`, [id]);
      await c.query('set role jisr_app');
      expect((await c.query(`select count(*)::int as n from checkins where resident_id=$1`, [id])).rows[0].n).toBe(0);
    } finally {
      await c.query('rollback');
      c.release();
    }
  }, 30000);

  it('employer role is denied every Layer 5 base table', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('set role jisr_employer');
      // Each denied query aborts the transaction; savepoints keep it usable.
      for (const sql of [
        `select count(*) from checkins`,
        `select count(*) from trusted_contacts`,
        `select count(*) from reminder_events`,
        `select count(*) from navigator_tasks`,
      ]) {
        await c.query('savepoint denied');
        await expect(c.query(sql)).rejects.toThrow(/permission denied/);
        await c.query('rollback to savepoint denied');
      }
    } finally {
      await c.query('rollback');
      c.release();
    }
  }, 30000);

  it('check-in fairness suppresses small groups and the companion report is aggregate-only', async () => {
    const f = await pool.query(`select n from gapfinder_checkin_fairness`);
    expect(f.rows.length).toBeGreaterThan(0);
    for (const row of f.rows) expect(Number(row.n)).toBeGreaterThanOrEqual(10);
    const s = await pool.query(`select 1 from gapfinder_checkin_fairness where group_value='Group S'`);
    expect(s.rowCount).toBe(0);
    const cols = await pool.query(
      `select column_name from information_schema.columns where table_name='gapfinder_companion_report' order by ordinal_position`,
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(['sessions_total', 'heavy_total', 'heavy_share', 'crisis_sessions']);
  }, 30000);
});