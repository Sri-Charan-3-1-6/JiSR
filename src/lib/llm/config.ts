// Provider configuration. Keys come ONLY from env and are never logged,
// printed, or returned to the client.

export interface Provider {
  name: 'openrouter' | 'llm2';
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const FALLBACK_MODEL = 'openrouter/free';
export const REQUEST_TIMEOUT_MS = 8000;
export const MODEL_REFRESH_MS = 6 * 60 * 60 * 1000;
export const MODEL_FAILURE_RETRY_MS = 60 * 1000;
export const MAX_MODELS_PER_REQUEST = 3;
export const MAX_GROUPS = 3;
export const BREAKER_THRESHOLD = 3;
export const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

export function getProviders(): Provider[] {
  const providers: Provider[] = [];
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    providers.push({ name: 'openrouter', baseUrl: OPENROUTER_BASE_URL, apiKey: orKey });
  }
  const { LLM2_BASE_URL, LLM2_API_KEY, LLM2_MODEL } = process.env;
  if (LLM2_BASE_URL && LLM2_API_KEY && LLM2_MODEL) {
    providers.push({
      name: 'llm2',
      baseUrl: LLM2_BASE_URL.replace(/\/$/, ''),
      apiKey: LLM2_API_KEY,
      model: LLM2_MODEL,
    });
  }
  return providers;
}