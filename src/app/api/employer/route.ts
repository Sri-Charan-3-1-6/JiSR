import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Employer-facing API: reads ONLY the aggregated views. Small groups (<10)
// are already suppressed inside the views; the UI renders them as "<10".
export async function GET() {
  const [areas, languages, ages, nationalities] = await Promise.all([
    query(`select group_value, resident_count from employer_area_counts order by group_value`),
    query(`select group_value, resident_count from employer_language_counts order by group_value`),
    query(`select group_value, resident_count from employer_age_counts order by group_value`),
    query(`select group_value, resident_count from employer_nationality_counts order by group_value`),
  ]);
  const totals = await query(`select screenings_total, crisis_screens_total from employer_screening_totals`);
  return NextResponse.json({ areas, languages, ages, nationalities, totals: totals[0] ?? null });
}