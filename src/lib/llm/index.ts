import { one, query } from '../db';
import { explainTemplate, type ExplainInput, type Explanation } from '../explain';
import { generateExplanation } from './client';
import { validateExplanation } from './validate';

export { generateExplanation, buildMessages, resetBreaker } from './client';
export { filterFreeModels, getFreeModels, resetModelCache } from './models';
export { validateExplanation } from './validate';
export { getProviders } from './config';

// Cache-first: explanations are keyed only by (instrument, band, language)
// and contain no personal data, so one row serves every resident. Crisis
// bypasses the cache entirely — it is always the fixed template.
export async function explainResult(input: ExplainInput): Promise<Explanation> {
  if (input.band === 'crisis') {
    return { text: explainTemplate(input), source: 'template' };
  }
  try {
    const cached = await one<{ text: string; source: 'llm' | 'template' }>(
      `select text, source from explanation_cache
       where instrument = $1 and band = $2 and language = $3`,
      [input.instrument, input.band, input.language],
    );
    // Cached LLM text is re-validated on read: if the guard rules were
    // tightened after it was stored, it is regenerated instead of served.
    if (cached && (cached.source === 'template' || validateExplanation(cached.text, input.language))) {
      return { text: cached.text, source: cached.source };
    }
  } catch {
    // Cache unavailable — fall through to generation.
  }
  const generated = await generateExplanation(input);
  try {
    await query(
      `insert into explanation_cache (instrument, band, language, text, source, model)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (instrument, band, language) do nothing`,
      [input.instrument, input.band, input.language, generated.text, generated.source, generated.model ?? null],
    );
  } catch {
    // Saving is best-effort; never block the explanation.
  }
  return { text: generated.text, source: generated.source };
}