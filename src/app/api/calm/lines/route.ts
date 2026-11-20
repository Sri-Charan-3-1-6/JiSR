import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

// Pre-written supportive lines from the database — never AI-generated.
// Jokes are included only with jokes=1 AND the resident's opt-in (or the
// faculty review view, which lists everything for moderation).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const language = url.searchParams.get('language') ?? 'en';
  if (!['en', 'ar', 'hi'].includes(language)) {
    return NextResponse.json({ error: 'language must be en, ar or hi' }, { status: 400 });
  }
  const exercise = url.searchParams.get('exercise');
  const review = url.searchParams.get('review') === '1';
  const wantsJokes = url.searchParams.get('jokes') === '1';
  const residentId = url.searchParams.get('residentId');

  let includeJokes = false;
  if (wantsJokes) {
    if (review || !residentId) includeJokes = true;
    else {
      const opt = await one<{ jokes_opt_in: boolean }>(
        `select jokes_opt_in from companion_prefs where resident_id = $1`,
        [residentId],
      );
      includeJokes = Boolean(opt?.jokes_opt_in);
    }
  }

  const params: unknown[] = [language];
  let sql = `select id, language, kind, exercise, body, reviewed, reviewed_by, reviewed_at
             from calm_lines where language = $1`;
  if (!includeJokes) sql += ` and kind = 'support'`;
  if (exercise && ['breathing', 'grounding', 'memory'].includes(exercise)) {
    params.push(exercise);
    sql += ` and (exercise = $${params.length} or exercise is null)`;
  }
  sql += ` order by kind, id`;
  const lines = await query(sql, params);
  return NextResponse.json({ lines });
}