import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { explainResult, llmExplanation } from '@/lib/llm';
import { explainTemplate, type ExplainInput } from '@/lib/explain';
import { detectChange, type WearableDay } from '@/lib/wearable';
import { buildFhirBundle } from '@/lib/fhir';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const input: ExplainInput = { instrument: 'PHQ9', total: 12, band: 'moderate', language: 'en' };

function stubKey() {
  vi.stubEnv('LLM_API_KEY', 'test-key-not-real');
  vi.stubEnv('OPENAI_API_KEY', '');
}
function noKey() {
  vi.stubEnv('LLM_API_KEY', '');
  vi.stubEnv('OPENAI_API_KEY', '');
}

describe('LLM explanation with template fallback (hard rule 2)', () => {
  it('falls back to the template when the LLM call fails', async () => {
    stubKey();
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await explainResult(input);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.source).toBe('template');
    expect(r.text).toBe(explainTemplate(input));
    expect(r.text).toContain('screening, not a diagnosis');
  });

  it('falls back to the template on a non-OK HTTP response', async () => {
    stubKey();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const r = await explainResult(input);
    expect(r.source).toBe('template');
  });

  it('falls back to the template when the response has no content', async () => {
    stubKey();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    }));
    const r = await explainResult(input);
    expect(r.source).toBe('template');
  });

  it('uses the template without calling fetch when no API key is configured', async () => {
    noKey();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await explainResult(input);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.source).toBe('template');
    expect(await llmExplanation(input)).toBeNull();
  });

  it('NEVER calls the LLM for a crisis band, even with a key', async () => {
    stubKey();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await explainResult({ ...input, band: 'crisis', total: 22 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.source).toBe('template');
    expect(r.text).toContain('talk to a human right now');
  });

  it('uses the LLM text when the call succeeds (non-crisis)', async () => {
    stubKey();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'A kind explanation.' } }] }),
    }));
    const r = await explainResult(input);
    expect(r).toEqual({ text: 'A kind explanation.', source: 'llm' });
  });

  it('never sends the API key anywhere except the Authorization header', async () => {
    stubKey();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await explainResult(input);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key-not-real');
    expect(init.body).not.toContain('test-key-not-real');
    expect(String(init.body)).toContain('You do NOT diagnose');
  });

  it('has a non-empty template for every band in every language, always screening-not-diagnosis', () => {
    const bands = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];
    const marker = { en: 'screening, not a diagnosis', ar: 'فحص استرشادي وليس تشخيصًا', hi: 'स्क्रीनिंग है, निदान नहीं' };
    for (const language of ['en', 'ar', 'hi'] as const) {
      for (const band of bands) {
        const text = explainTemplate({ instrument: 'GAD7', total: 10, band, language });
        expect(text.length).toBeGreaterThan(40);
        expect(text).toContain(marker[language]);
        expect(text).not.toContain('{instrument}');
      }
    }
  });
});

describe('wearable change detection (invite only, never diagnose)', () => {
  function series(fn: (i: number) => { sleep: number; steps: number }): WearableDay[] {
    return Array.from({ length: 21 }, (_, i) => {
      const { sleep, steps } = fn(i);
      return {
        day: `2026-10-${String(i + 1).padStart(2, '0')}`,
        sleep_hours: sleep,
        steps,
        resting_hr: 62,
      };
    });
  }

  it('reports insufficient data with fewer than 10 days', () => {
    const r = detectChange(series(() => ({ sleep: 7, steps: 8000 })).slice(0, 9));
    expect(r.insufficientData).toBe(true);
    expect(r.changed).toBe(false);
  });

  it('detects no change on a stable baseline', () => {
    const r = detectChange(series(() => ({ sleep: 7, steps: 8000 })));
    expect(r.insufficientData).toBe(false);
    expect(r.changed).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('detects a combined sleep + activity drop vs the own baseline', () => {
    const r = detectChange(series((i) =>
      i >= 18 ? { sleep: 4.5, steps: 3000 } : { sleep: 7, steps: 8000 },
    ));
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('both');
    expect(r.baseline.sleep).toBeCloseTo(7, 5);
    expect(r.recent.sleep).toBeCloseTo(4.5, 5);
  });

  it('detects a sleep-only drop', () => {
    const r = detectChange(series((i) =>
      i >= 18 ? { sleep: 4.5, steps: 8000 } : { sleep: 7, steps: 8000 },
    ));
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('sleep');
  });

  it('does not flag small normal variation', () => {
    const r = detectChange(series((i) =>
      i >= 18 ? { sleep: 6.5, steps: 7000 } : { sleep: 7, steps: 8000 },
    ));
    expect(r.changed).toBe(false);
  });

  it('handles string numerics from node-postgres', () => {
    const days = series((i) => (i >= 18 ? { sleep: 4.5, steps: 3000 } : { sleep: 7, steps: 8000 }))
      .map((d) => ({ ...d, sleep_hours: String(d.sleep_hours) as unknown as number, steps: String(d.steps) as unknown as number }));
    const r = detectChange(days);
    expect(r.changed).toBe(true);
  });
});

describe('FHIR-shaped export (interoperability-ready, not certified)', () => {
  const screenings = [{
    instrument: 'PHQ9',
    answers: [1, 2, 1, 2, 1, 1, 1, 1, 2],
    total_score: 12,
    band: 'moderate',
    created_at: '2026-11-01T10:00:00Z',
  }];
  const flags = { physical_conditions: ['diabetes (self-reported)'], sleep_flag: true, pain_flag: false };

  it('builds a collection Bundle tagged synthetic and not certified', () => {
    const b = buildFhirBundle('JISR-TEST-001', screenings, flags);
    expect(b.resourceType).toBe('Bundle');
    expect(b.type).toBe('collection');
    const codes = b.meta.tag.map((t: { code: string }) => t.code);
    expect(codes).toContain('synthetic');
    expect(codes).toContain('interoperability-ready');
    expect(JSON.stringify(b)).toContain('not certified');
  });

  it('emits a QuestionnaireResponse with 9 integer answers and a score Observation', () => {
    const b = buildFhirBundle('JISR-TEST-001', screenings, null);
    const resources = (b.entry as { resource: { resourceType: string } }[]).map((e) => e.resource);
    const qr = resources.find((r) => r.resourceType === 'QuestionnaireResponse') as never as {
      questionnaire: string; item: { linkId: string; answer: { valueInteger: number }[] }[];
      subject: { identifier: { value: string } };
    };
    expect(qr.questionnaire).toBe('Questionnaire/phq-9');
    expect(qr.item).toHaveLength(9);
    expect(qr.item[8].answer[0].valueInteger).toBe(2);
    expect(qr.subject.identifier.value).toBe('JISR-TEST-001');
    const obs = resources.find((r) => r.resourceType === 'Observation') as never as {
      valueInteger: number; interpretation: { text: string }[];
    };
    expect(obs.valueInteger).toBe(12);
    expect(obs.interpretation[0].text).toContain('not a diagnosis');
  });

  it('emits flag Observations and no real identifiers', () => {
    const b = buildFhirBundle('JISR-TEST-001', screenings, flags);
    const json = JSON.stringify(b);
    expect(json).toContain('Self-reported sleep difficulty flag');
    expect(json).toContain('Self-reported pain flag');
    expect(json).toContain('diabetes (self-reported)');
    expect(json).not.toContain('"name"');
    expect(json).toContain('urn:jisr:pseudo-id');
  });
});

describe('i18n catalogs', () => {
  const keys = (o: Record<string, unknown>, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
    );
  const load = (l: string) => JSON.parse(readFileSync(path.resolve(__dirname, `../messages/${l}.json`), 'utf8'));

  it('en, ar and hi have identical key sets', () => {
    const en = keys(load('en'));
    for (const l of ['ar', 'hi']) {
      expect(new Set(keys(load(l)))).toEqual(new Set(en));
    }
    expect(en.length).toBeGreaterThan(300);
  });

  it('every catalog keeps the screening-not-diagnosis and synthetic-data claims', () => {
    for (const l of ['en', 'ar', 'hi']) {
      const m = load(l);
      expect(m.common.screeningNotDiagnosis.length).toBeGreaterThan(5);
      expect(m.common.syntheticBadge.length).toBeGreaterThan(5);
      expect(m.wearable.simulatedNote.length).toBeGreaterThan(5);
      expect(m.summary.interoperable.length).toBeGreaterThan(5);
    }
  });
});