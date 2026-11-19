import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';
import { buildFhirBundle, type HealthFlagsRow, type ScreeningRow } from '@/lib/fhir';

// Printable primary-care summary + FHIR-shaped export. Requires the
// share_with_primary_care consent scope; revocation blocks it immediately.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'share_with_primary_care'`,
    [id],
  );
  if (!consent?.granted) {
    return NextResponse.json({ consentRequired: true }, { status: 403 });
  }
  const resident = await one<{ pseudo_id: string; language: string }>(
    `select pseudo_id, language from residents where id = $1`,
    [id],
  );
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });

  const screenings = await query<ScreeningRow>(
    `select instrument, answers, total_score, band, created_at
     from screenings where resident_id = $1 order by created_at`,
    [id],
  );
  const flags = await one<HealthFlagsRow>(
    `select physical_conditions, sleep_flag, pain_flag from health_flags where resident_id = $1`,
    [id],
  );
  const cases = await query(
    `select risk_tier, state, created_at from cases where resident_id = $1 order by created_at desc`,
    [id],
  );
  const fhir = buildFhirBundle(resident.pseudo_id, screenings, flags ?? null);
  return NextResponse.json({ resident, screenings, flags, cases, fhir });
}