import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { query, one, simNow } from '@/lib/db';
import { score, type Instrument } from '@/lib/scoring';
import { detectCrisis } from '@/lib/crisis';
import { matchSupport, type RiskTier } from '@/lib/matching';
import { computeDeadlines } from '@/lib/sla';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const instrument = body.instrument as Instrument;
  const answers = body.answers as number[];
  const freeText: string | null = body.freeText ?? null;
  let residentId: string | null = body.residentId ?? null;

  if (instrument !== 'PHQ9' && instrument !== 'GAD7') {
    return NextResponse.json({ error: 'instrument must be PHQ9 or GAD7' }, { status: 400 });
  }

  let result;
  try {
    result = score(instrument, answers);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const crisis = detectCrisis(instrument, answers, freeText);
  const tier: RiskTier = crisis.crisis ? 'crisis' : result.band;
  const match = matchSupport(tier);
  const now = await simNow();
  const deadlines = computeDeadlines(tier, now);

  if (!residentId) {
    const pseudoId = `JISR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const r = await one<{ id: string }>(
      `insert into residents (pseudo_id, language) values ($1, $2) returning id`,
      [pseudoId, body.language ?? 'en'],
    );
    residentId = r!.id;
    await query(
      `insert into consent_scopes (resident_id, scope, granted)
       select $1, s.scope, false
       from (values ('store_results'), ('share_with_primary_care'),
                    ('anonymous_aggregate_stats'), ('wearable_signal'),
                    ('navigator_contact')) as s(scope)`,
      [residentId],
    );
  }

  const screening = await one<{ id: string }>(
    `insert into screenings
       (resident_id, instrument, answers, free_text, total_score, band, crisis_flag, crisis_reason, created_at)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
     returning id`,
    [residentId, instrument, JSON.stringify(answers), freeText, result.total, result.band, crisis.crisis, crisis.reason, now],
  );

  // Storing the result requires store_results consent — grant exactly what
  // this action needs, and record it in the audit log (default is OFF).
  await query(
    `insert into consent_scopes (resident_id, scope, granted, updated_at)
     values ($1, 'store_results', true, $2)
     on conflict (resident_id, scope)
     do update set granted = true, updated_at = excluded.updated_at`,
    [residentId, now],
  );
  await query(
    `insert into consent_audit (resident_id, scope, action, actor, created_at)
     values ($1, 'store_results', 'grant', 'system:screening', $2)`,
    [residentId, now],
  );

  const kase = await one<{ id: string }>(
    `insert into cases
       (resident_id, screening_id, risk_tier, state, matched_step,
        sla_contact_due, sla_book_due, sla_attend_due, sla_followup_due, created_at)
     values ($1, $2, $3, 'SCREENED', $4, $5, $6, $7, $8, $9)
     returning id`,
    [residentId, screening!.id, tier, match.options[0].key,
     deadlines.contactDue, deadlines.bookDue, deadlines.attendDue, deadlines.followupDue, now],
  );

  await query(
    `insert into case_events (case_id, event_type, to_state, detail, created_at)
     values ($1, 'state_change', 'SCREENED', $2::jsonb, $3)`,
    [kase!.id, JSON.stringify({ screeningId: screening!.id, tier, crisisReason: crisis.reason }), now],
  );

  return NextResponse.json({
    residentId,
    screeningId: screening!.id,
    caseId: kase!.id,
    result,
    crisis,
    tier,
    match,
  });
}