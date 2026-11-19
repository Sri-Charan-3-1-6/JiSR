import {
  FALLBACK_MODEL,
  MODEL_FAILURE_RETRY_MS,
  MODEL_REFRESH_MS,
  OPENROUTER_BASE_URL,
  REQUEST_TIMEOUT_MS,
} from './config';

// Free-model discovery. Free models rotate, so nothing is hardcoded: the
// list is refreshed from OpenRouter every 6 hours. Only models whose prompt
// AND completion pricing are both "0" (and whose id ends in ":free") qualify.

interface ModelEntry {
  id?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
}

export function filterFreeModels(payload: unknown): string[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return (data as ModelEntry[])
    .filter(
      (m) =>
        typeof m.id === 'string' &&
        m.id.endsWith(':free') &&
        m.pricing?.prompt === '0' &&
        m.pricing?.completion === '0',
    )
    .map((m) => m.id as string);
}

let cache: { models: string[]; fetchedAt: number } | null = null;

export function resetModelCache() {
  cache = null;
}

export async function getFreeModels(): Promise<string[]> {
  if (cache && Date.now() - cache.fetchedAt < MODEL_REFRESH_MS) return cache.models;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, { signal: controller.signal });
    if (!res.ok) throw new Error(`models list HTTP ${res.status}`);
    const list = filterFreeModels(await res.json());
    const models = list.length > 0 ? list : [FALLBACK_MODEL];
    cache = { models, fetchedAt: Date.now() };
    return models;
  } catch {
    // Discovery failed: use the router's free alias, retry discovery soon.
    cache = {
      models: [FALLBACK_MODEL],
      fetchedAt: Date.now() - MODEL_REFRESH_MS + MODEL_FAILURE_RETRY_MS,
    };
    return cache.models;
  } finally {
    clearTimeout(timer);
  }
}