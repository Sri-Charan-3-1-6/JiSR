export type Instrument = 'PHQ9' | 'GAD7';

export type Band =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'moderately_severe'
  | 'severe';

export const PHQ9_ITEMS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading or watching television',
  'Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

export const GAD7_ITEMS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];

export const ANSWER_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export function itemsFor(instrument: Instrument): string[] {
  return instrument === 'PHQ9' ? PHQ9_ITEMS : GAD7_ITEMS;
}

export function bandFor(instrument: Instrument, total: number): Band {
  if (instrument === 'PHQ9') {
    if (total <= 4) return 'minimal';
    if (total <= 9) return 'mild';
    if (total <= 14) return 'moderate';
    if (total <= 19) return 'moderately_severe';
    return 'severe';
  }
  if (total <= 4) return 'minimal';
  if (total <= 9) return 'mild';
  if (total <= 14) return 'moderate';
  return 'severe';
}

export interface ScoreResult {
  instrument: Instrument;
  total: number;
  band: Band;
}

export function score(
  instrument: Instrument,
  answers: number[],
): ScoreResult {
  const expected = itemsFor(instrument).length;
  if (answers.length !== expected) {
    throw new Error(`${instrument} expects ${expected} answers, got ${answers.length}`);
  }
  if (answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    throw new Error('Answers must be integers 0-3');
  }
  const total = answers.reduce((sum, a) => sum + a, 0);
  return { instrument, total, band: bandFor(instrument, total) };
}