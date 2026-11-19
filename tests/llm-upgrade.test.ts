import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMessages,
  explainResult,
  filterFreeModels,
  generateExplanation,
  getFreeModels,
  resetBreaker,
  resetModelCache,
  validateExplanation,
} from '@/lib/llm';
import { explainTemplate, type ExplainInput, type Language } from '@/lib/explain';
import { one, query } from '@/lib/db';

const input: ExplainInput = { instrument: 'PHQ9', total: 12, band: 'moderate', language: 'en' };

const VALID_EN =
  'Your answers suggest a moderate level of symptoms right now. This is a screening, not a diagnosis, so it does not label you. The support steps shown below are a good next step.';

const freePayload = (n: number) => ({
  data: Array.from({ length: n }, (_, i) => ({
    id: `test/m${i}:free`,
    pricing: { prompt: '0', completion: '0' },
  })),
});
const okRes = (content = VALID_EN, model = 'test/m0:free') => ({
  ok: true,
  json: async () => ({ model, choices: [{ message: { content } }] }),
});
const errRes = (status: number, body = '') => ({ ok: false, status, text: async () => body });

function stubOR() {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key-not-real');
  vi.stubEnv('LLM2_BASE_URL', '');
  vi.stubEnv('LLM2_API_KEY', '');
  vi.stubEnv('LLM2_MODEL', '');
}
function stubBoth() {
  stubOR();
  vi.stubEnv('LLM2_BASE_URL', 'https://second.example/v1');
  vi.stubEnv('LLM2_API_KEY', 'second-key-not-real');
  vi.stubEnv('LLM2_MODEL', 'second-model');
}

type ChatFn = (url: string, init?: { body: string; headers: Record<string, string> }) => Promise<unknown>;
function routerFetch(chat: ChatFn, modelCount = 9) {
  return vi.fn(async (url: unknown, init?: unknown) => {
    const u = String(url);
    if (u.endsWith('/models')) return { ok: true, json: async () => freePayload(modelCount) };
    return chat(u, init as { body: string; headers: Record<string, string> });
  });
}
const chatCalls = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.filter(([u]) => String(u).includes('/chat/completions'));

beforeEach(() => {
  resetBreaker();
  resetModelCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetBreaker();
  resetModelCache();
});

describe('free-only model filter', () => {
  it('excludes paid models and non-:free ids even with zero pricing', () => {
    const payload = {
      data: [
        { id: 'a:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'b:free', pricing: { prompt: '0.0001', completion: '0' } },
        { id: 'c:free', pricing: { prompt: '0', completion: '0.5' } },
        { id: 'paid-model', pricing: { prompt: '0', completion: '0' } },
        { id: 'd:free', pricing: { prompt: '0', completion: '0' } },
      ],
    };
    expect(filterFreeModels(payload)).toEqual(['a:free', 'd:free']);
  });

  it('never sends a paid model in the models array', async () => {
    stubOR();
    const mixed = {
      data: [
        { id: 'paid/x', pricing: { prompt: '0.002', completion: '0.002' } },
        { id: 'ok/y:free', pricing: { prompt: '0', completion: '0' } },
      ],
    };
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/models')) return { ok: true, json: async () => mixed };
      return okRes();
    });
    vi.stubGlobal('fetch', fetchMock);
    await generateExplanation(input);
    const [, init] = chatCalls(fetchMock)[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.model).toBe('ok/y:free');
    expect(JSON.stringify(body)).not.toContain('paid/x');
  });

  it('uses openrouter/free when discovery fails, and caches a successful list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await getFreeModels()).toEqual(['openrouter/free']);
    resetModelCache();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => freePayload(2) }));
    vi.stubGlobal('fetch', fetchMock);
    await getFreeModels();
    await getFreeModels();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('provider order and fallback', () => {
  it('tries OpenRouter groups first, then provider 2, and uses its answer', async () => {
    stubBoth();
    const fetchMock = routerFetch(async (url) =>
      url.includes('openrouter.ai') ? errRes(500) : okRes(VALID_EN, 'second-model'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateExplanation(input);
    expect(r.source).toBe('llm');
    const orCalls = chatCalls(fetchMock).filter(([u]) => String(u).includes('openrouter.ai'));
    const p2Calls = chatCalls(fetchMock).filter(([u]) => String(u).includes('second.example'));
    expect(orCalls.length).toBe(3);
    expect(p2Calls.length).toBe(1);
    const body = JSON.parse((p2Calls[0][1] as { body: string }).body);
    expect(body.model).toBe('second-model');
    expect((p2Calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer second-key-not-real');
  });

  it('falls back to the template when every provider fails', async () => {
    stubBoth();
    vi.stubGlobal('fetch', routerFetch(async () => errRes(503), 1));
    const r = await generateExplanation(input);
    expect(r.source).toBe('template');
    expect(r.text).toBe(explainTemplate(input));
  });

  it('skips provider 2 entirely when its env vars are missing', async () => {
    stubOR();
    vi.stubEnv('LLM2_BASE_URL', 'https://second.example/v1'); // key+model missing
    const fetchMock = routerFetch(async () => errRes(500), 1);
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateExplanation(input);
    expect(r.source).toBe('template');
    expect(chatCalls(fetchMock).every(([u]) => String(u).includes('openrouter.ai'))).toBe(true);
  });
});

describe('circuit breaker', () => {
  it('opens after 3 consecutive failures and skips the LLM for 5 minutes', async () => {
    stubOR();
    const fetchMock = routerFetch(() => Promise.reject(new Error('down')));
    vi.stubGlobal('fetch', fetchMock);
    const r1 = await generateExplanation(input);
    expect(r1.source).toBe('template');
    expect(chatCalls(fetchMock).length).toBe(3); // 3 groups, then breaker opens
    const callsAfterFirst = fetchMock.mock.calls.length;
    const r2 = await generateExplanation(input);
    expect(r2.source).toBe('template');
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // no fetch at all
  });

  it('closes again after the cooldown and a success resets the counter', async () => {
    stubOR();
    vi.useFakeTimers({ toFake: ['Date'] });
    let down = true;
    const fetchMock = routerFetch(async () => (down ? errRes(500) : okRes()));
    vi.stubGlobal('fetch', fetchMock);
    await generateExplanation(input); // 3 failures -> open
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    down = false;
    const r = await generateExplanation(input);
    expect(r.source).toBe('llm');
  });
});

describe('daily-limit 429', () => {
  it('stops retrying OpenRouter immediately and goes to provider 2', async () => {
    stubBoth();
    const fetchMock = routerFetch(async (url) =>
      url.includes('openrouter.ai')
        ? errRes(429, 'Rate limit exceeded: free-models-per-day. Add credits to continue.')
        : okRes(VALID_EN, 'second-model'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateExplanation(input);
    expect(r.source).toBe('llm');
    expect(chatCalls(fetchMock).filter(([u]) => String(u).includes('openrouter.ai')).length).toBe(1);
  });

  it('goes straight to the template when there is no provider 2', async () => {
    stubOR();
    const fetchMock = routerFetch(async () => errRes(429, 'free-models-per-day limit reached'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateExplanation(input);
    expect(r.source).toBe('template');
    expect(chatCalls(fetchMock).length).toBe(1);
  });
});

describe('models-array size rejection', () => {
  it('retries with a smaller request when the API rejects the array', async () => {
    stubOR();
    const fetchMock = routerFetch(async (_url, init) => {
      const body = JSON.parse(init!.body);
      if (Array.isArray(body.models) && body.models.length > 1) {
        return errRes(400, 'models array may contain at most 1 model for this endpoint');
      }
      return okRes();
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateExplanation(input);
    expect(r.source).toBe('llm');
    const bodies = chatCalls(fetchMock).map(([, i]) => JSON.parse((i as { body: string }).body));
    expect(bodies[0].models.length).toBe(3);
    expect(bodies[1].models ?? bodies[1].model).toBeDefined();
    expect(JSON.stringify(bodies[1]).length).toBeLessThan(JSON.stringify(bodies[0]).length);
    expect(bodies.every((b) => (b.models ?? [b.model]).every((m: string) => m.endsWith(':free')))).toBe(true);
  });
});

describe('prompt privacy whitelist', () => {
  it('prompt contains ONLY instrument, band and language — nothing personal', async () => {
    stubOR();
    const dirty = {
      instrument: 'PHQ9',
      total: 17,
      band: 'moderate',
      language: 'en',
      pseudoId: 'JISR-ABC123',
      freeText: 'my secret diary entry',
      age: 34,
      nationality: 'Group A',
    } as unknown as ExplainInput;
    const fetchMock = routerFetch(async () => okRes());
    vi.stubGlobal('fetch', fetchMock);
    await generateExplanation(dirty);
    const [, init] = chatCalls(fetchMock)[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user').content as string;
    expect(userMsg).toContain('PHQ-9');
    expect(userMsg).toContain('moderate');
    expect(userMsg).toContain('English');
    for (const leak of ['17', 'JISR-', 'secret', '34', 'Group A', 'diary']) {
      expect(init.body).not.toContain(leak);
    }
    // No digits beyond the instrument name itself.
    expect(userMsg.replace(/PHQ-9|GAD-7/g, '')).not.toMatch(/\d/);
  });

  it('buildMessages ignores extra fields entirely', () => {
    const dirty = { instrument: 'GAD7', band: 'mild', language: 'hi', total: 9, name: 'Someone' } as unknown as ExplainInput;
    const msgs = buildMessages(dirty);
    const user = msgs[1].content;
    expect(user).toContain('GAD-7');
    expect(user).toContain('mild');
    expect(user).toContain('Hindi');
    expect(user).not.toContain('Someone');
    expect(user.replace(/PHQ-9|GAD-7/g, '')).not.toMatch(/\d/);
  });
});

describe('response validation', () => {
  const fails = async (content: string, language: Language = 'en') => {
    stubOR();
    vi.stubGlobal('fetch', routerFetch(async () => okRes(content)));
    const r = await generateExplanation({ ...input, language });
    expect(r.source).toBe('template');
    expect(r.text).toBe(explainTemplate({ ...input, language }));
  };

  it('rejects output of 120 words or more', () =>
    fails(`${'word '.repeat(125)} This is a screening, not a diagnosis, suggesting a level of symptoms.`));

  it('rejects the wrong language', () => fails(VALID_EN, 'ar'));

  it('rejects medication advice', () =>
    fails('Your answers suggest a moderate level of symptoms. This is a screening, not a diagnosis. You should take 50mg sertraline daily.'));

  it('rejects a diagnosis', () =>
    fails('You have depression. Your answers suggest a moderate level of symptoms. This is a screening, not a diagnosis.'));

  it('rejects output missing the screening-not-diagnosis statement', () =>
    fails('Your answers suggest a moderate level of symptoms right now and the support steps shown below are a good next step for you.'));

  it('accepts every fixed template in every language (they set the bar)', () => {
    const bands = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];
    for (const language of ['en', 'ar', 'hi'] as const) {
      for (const band of bands) {
        const text = explainTemplate({ instrument: 'GAD7', total: 10, band, language });
        expect(validateExplanation(text, language), `${language}/${band}`).toBe(true);
      }
    }
  });
});

describe('explanation cache (database)', () => {
  const KEY = { instrument: 'GAD7', band: 'minimal', language: 'hi' } as const;

  it('a cache hit serves the stored text and never calls the LLM', async () => {
    const orig = await one<{ text: string; source: string; model: string | null }>(
      `select text, source, model from explanation_cache
       where instrument = $1 and band = $2 and language = $3`,
      [KEY.instrument, KEY.band, KEY.language],
    );
    const upsert = (text: string, source: string, model: string | null) =>
      query(
        `insert into explanation_cache (instrument, band, language, text, source, model)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (instrument, band, language)
         do update set text = excluded.text, source = excluded.source, model = excluded.model`,
        [KEY.instrument, KEY.band, KEY.language, text, source, model],
      );
    await upsert('CACHED-TEST-MARKER', 'template', null);
    try {
      stubOR();
      const fetchMock = vi.fn(() => {
        throw new Error('LLM must not be called on a cache hit');
      });
      vi.stubGlobal('fetch', fetchMock);
      const r = await explainResult({ ...KEY, total: 2 });
      expect(r.text).toBe('CACHED-TEST-MARKER');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (orig) await upsert(orig.text, orig.source, orig.model);
      else await upsert(explainTemplate({ ...KEY, total: 2 }), 'template', null);
    }
  });

  it('crisis bypasses the cache and the LLM entirely', async () => {
    stubOR();
    const fetchMock = vi.fn(() => {
      throw new Error('crisis must never call the LLM');
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await explainResult({ instrument: 'PHQ9', total: 22, band: 'crisis', language: 'ar' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.source).toBe('template');
    expect(r.text).toContain('تتحدث إلى إنسان الآن');
  });
});

describe('server-side model logging', () => {
  it('logs the answering model to server logs only, never the key', async () => {
    stubOR();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', routerFetch(async () => okRes(VALID_EN, 'test/m7:free')));
    const r = await generateExplanation(input);
    expect(r.source).toBe('llm');
    const logged = logSpy.mock.calls.flat().join(' ');
    expect(logged).toContain('model=test/m7:free');
    expect(logged).not.toContain('test-key-not-real');
  });
});