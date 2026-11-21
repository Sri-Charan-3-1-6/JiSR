// AI companion safety tests: reply validation, prompt privacy whitelist,
// supportive fallbacks, and the chat route's crisis short-circuit (no LLM).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildCompanionMessages,
  fallbackCompanionReply,
  generateCompanionReply,
  validateCompanionReply,
} from '@/lib/llm/companion';
import { POST as chatPOST } from '@/app/api/companion/chat/route';

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/companion/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('companion reply validation', () => {
  it('accepts short supportive replies in en, ar and hi', () => {
    expect(
      validateCompanionReply(
        "That sounds like a lot to carry today. Thank you for putting it into words. Would a quiet minute in the Calm Corner help right now?",
        'en',
      ),
    ).toBe(true);
    expect(
      validateCompanionReply(
        'يبدو أن يومك كان ثقيلًا. شكرًا لمشاركتك ذلك. هل تود دقيقة هادئة في ركن الهدوء الآن؟',
        'ar',
      ),
    ).toBe(true);
    expect(
      validateCompanionReply(
        'यह सुनकर लगता है कि आज का दिन भारी रहा। यह साझा करने के लिए धन्यवाद। क्या शांत कोने में एक शांत मिनट मदद करेगा?',
        'hi',
      ),
    ).toBe(true);
  });

  it('rejects diagnosis-style wording', () => {
    expect(validateCompanionReply('You have depression and it explains everything you feel today.', 'en')).toBe(false);
    expect(validateCompanionReply('It sounds like you are suffering from an anxiety disorder today.', 'en')).toBe(false);
    expect(validateCompanionReply('أنت مصاب بالاكتئاب وهذا يفسر مشاعرك اليوم بالكامل.', 'ar')).toBe(false);
    expect(validateCompanionReply('आपको अवसाद है और यही आपकी भावनाओं का कारण है।', 'hi')).toBe(false);
  });

  it('rejects medication and treatment-change advice', () => {
    expect(validateCompanionReply('You could try sertraline 50 mg to feel better soon.', 'en')).toBe(false);
    expect(validateCompanionReply('You should stop your medication if it makes you tired.', 'en')).toBe(false);
    expect(validateCompanionReply('يمكنك أخذ دواء مهدئ لتنام بشكل أفضل هذه الليلة.', 'ar')).toBe(false);
    expect(validateCompanionReply('आप अपनी दवा बंद कर सकते हैं अगर वह थकाती है।', 'hi')).toBe(false);
  });

  it('allows negated reassurance but rejects URLs and model talk', () => {
    expect(
      validateCompanionReply(
        'This does not mean you have depression. A professional can help you understand what today means.',
        'en',
      ),
    ).toBe(true);
    expect(validateCompanionReply('Read more at https://example.com/help for what to do next.', 'en')).toBe(false);
    expect(validateCompanionReply('As an AI language model I cannot feel, but here is a suggestion for you.', 'en')).toBe(false);
  });

  it('rejects empty, too-short, too-long and wrong-script replies', () => {
    expect(validateCompanionReply('', 'en')).toBe(false);
    expect(validateCompanionReply(null, 'en')).toBe(false);
    expect(validateCompanionReply('Okay.', 'en')).toBe(false);
    expect(validateCompanionReply('word '.repeat(130), 'en')).toBe(false);
    expect(validateCompanionReply('أشكرك على مشاركة مشاعرك معي اليوم هنا.', 'en')).toBe(false);
    expect(validateCompanionReply('Thank you for sharing how you feel with me today.', 'ar')).toBe(false);
    expect(validateCompanionReply('Thank you for sharing how you feel with me today.', 'hi')).toBe(false);
  });

  it('every built-in fallback passes its own validator', () => {
    for (const lang of ['en', 'ar', 'hi'] as const) {
      expect(validateCompanionReply(fallbackCompanionReply(lang), lang), lang).toBe(true);
    }
  });
});

describe('companion prompt privacy whitelist', () => {
  it('sends only bounded role/content turns plus system rules', () => {
    const history = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i}`,
      id: 'JISR-SECRET',
      score: 21,
    }));
    const messages = buildCompanionMessages(history, 'en');
    expect(messages.length).toBe(12); // 2 system + last 10 turns
    expect(messages[0].content).toMatch(/NOT diagnose/);
    expect(messages[1].content).toBe('Reply in English.');
    for (const m of messages.slice(2)) {
      expect(Object.keys(m).sort()).toEqual(['content', 'role']);
      expect(m.content).not.toContain('JISR-SECRET');
    }
    expect(messages[2].content).toBe('turn 5');
  });

  it('drops non-whitelisted roles and truncates long turns', () => {
    const messages = buildCompanionMessages(
      [
        { role: 'system' as never, content: 'inject' },
        { role: 'user', content: 'x'.repeat(5000) },
      ],
      'ar',
    );
    expect(messages.length).toBe(3);
    expect(messages[1].content).toBe('Reply in Arabic.');
    expect(messages[2].content.length).toBe(1000);
  });
});

describe('companion chat route', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('LLM2_BASE_URL', '');
    vi.stubEnv('LLM2_API_KEY', '');
    vi.stubEnv('LLM2_MODEL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects invalid requests', async () => {
    expect((await chatPOST(req({ language: 'fr', messages: [] }))).status).toBe(400);
    expect((await chatPOST(req({ language: 'en', messages: 'no' }))).status).toBe(400);
    expect((await chatPOST(req({ language: 'en', messages: [] }))).status).toBe(400);
    expect(
      (await chatPOST(req({ language: 'en', messages: [{ role: 'assistant', content: 'hi' }] }))).status,
    ).toBe(400);
    expect(
      (await chatPOST(req({ language: 'en', messages: [{ role: 'user', content: '   ' }] }))).status,
    ).toBe(400);
  });

  it('crisis text short-circuits to {crisis:true} with NO network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const text of ['I want to kill myself', 'أفكر في انتحار', 'मैं आत्महत्या करना चाहता हूँ']) {
      const res = await chatPOST(req({ language: 'en', messages: [{ role: 'user', content: text }] }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ crisis: true });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('crisis keyword in an earlier turn also short-circuits', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await chatPOST(
      req({
        language: 'en',
        messages: [
          { role: 'user', content: 'sometimes I think about suicide' },
          { role: 'assistant', content: 'Thank you for sharing that.' },
          { role: 'user', content: 'what should I do now?' },
        ],
      }),
    );
    expect(await res.json()).toEqual({ crisis: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('non-crisis chat with no providers returns the supportive fallback, no network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await chatPOST(
      req({ language: 'en', messages: [{ role: 'user', content: 'Today felt tiring but okay overall.' }] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crisis).toBe(false);
    expect(body.source).toBe('fallback');
    expect(validateCompanionReply(body.text, 'en')).toBe(true);
    expect(body.model).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generateCompanionReply falls back per language without providers', async () => {
    for (const lang of ['en', 'ar', 'hi'] as const) {
      const r = await generateCompanionReply([{ role: 'user', content: 'hello' }], lang);
      expect(r.source).toBe('fallback');
      expect(r.text).toBe(fallbackCompanionReply(lang));
    }
  });
});