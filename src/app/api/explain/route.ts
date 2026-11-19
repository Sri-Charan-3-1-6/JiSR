import { NextRequest, NextResponse } from 'next/server';
import { explainResult } from '@/lib/llm';
import type { Instrument, Language } from '@/lib/explain';

const INSTRUMENTS = ['PHQ9', 'GAD7'];
const LANGUAGES = ['en', 'ar', 'hi'];
const BANDS = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];

// Worst case: several 8s provider attempts before the template fallback.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { instrument, total, band, language } = body ?? {};
  if (
    !INSTRUMENTS.includes(instrument) ||
    !BANDS.includes(band) ||
    !LANGUAGES.includes(language) ||
    typeof total !== 'number' ||
    !Number.isInteger(total) ||
    total < 0 ||
    total > 27
  ) {
    return NextResponse.json({ error: 'Invalid explanation request' }, { status: 400 });
  }
  const explanation = await explainResult({
    instrument: instrument as Instrument,
    total,
    band,
    language: language as Language,
  });
  return NextResponse.json(explanation);
}