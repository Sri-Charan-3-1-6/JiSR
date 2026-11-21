// Calm Corner constants. Exercises run fully client-side (offline-capable);
// supportive lines come from the calm_lines table (pre-written, reviewed),
// never AI-generated. Symbols are language-neutral SVG shapes.

export type Exercise = 'breathing' | 'grounding' | 'memory' | 'bubbles' | 'echo';

export const EXERCISES: readonly Exercise[] = ['breathing', 'grounding', 'memory', 'bubbles', 'echo'];

export const BUBBLE_GOAL = 12;
export const ECHO_ROUNDS = [2, 3, 4] as const;

export const BREATHING_PHASES = [
  { key: 'inhale', seconds: 4 },
  { key: 'hold', seconds: 4 },
  { key: 'exhale', seconds: 4 },
  { key: 'hold2', seconds: 4 },
] as const;

export const GROUNDING_STEPS = [
  { key: 'see', count: 5 },
  { key: 'touch', count: 4 },
  { key: 'hear', count: 3 },
  { key: 'smell', count: 2 },
  { key: 'taste', count: 1 },
] as const;

export const MEMORY_SYMBOLS = ['sun', 'moon', 'star', 'leaf', 'wave', 'hill'] as const;

export const CALM_LINES_CACHE_PREFIX = 'jisr_calm_lines_';