import { NextRequest, NextResponse } from 'next/server';
import { detectCrisis } from '@/lib/crisis';
import type { Language } from '@/lib/explain';
import { generateCompanionReply, type CompanionTurn } from '@/lib/llm/companion';

const LANGUAGES = ['en', 'ar', 'hi'];
const MAX_TURNS = 10;
const MAX_TURN_CHARS = 1000;

// Worst case: several 8s provider attempts before the supportive fallback.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { messages, language } = body ?? {};
  if (!LANGUAGES.includes(language) || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid companion request' }, { status: 400 });
  }
  const history: CompanionTurn[] = messages
    .filter(
      (m: unknown): m is CompanionTurn =>
        typeof m === 'object' &&
        m !== null &&
        ((m as CompanionTurn).role === 'user' || (m as CompanionTurn).role === 'assistant') &&
        typeof (m as CompanionTurn).content === 'string',
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TURN_CHARS) }));
  const last = history[history.length - 1];
  if (!last || last.role !== 'user' || !last.content.trim()) {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
  }

  // Fixed crisis rules run server-side too, BEFORE any LLM call. Crisis text
  // never reaches a provider from this route.
  const userText = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  if (detectCrisis('PHQ9', [0, 0, 0, 0, 0, 0, 0, 0, 0], userText).crisis) {
    return NextResponse.json({ crisis: true });
  }

  const reply = await generateCompanionReply(history, language as Language);
  return NextResponse.json({ crisis: false, text: reply.text, source: reply.source });
}