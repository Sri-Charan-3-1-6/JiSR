import { detectCrisis, type CrisisResult } from './crisis';

// Scripted decision tree — no LLM, no free text sent to any external model.
// Free text is scanned locally with the same fixed crisis rules as screening.
// moodTag is a simple self-reported tag; it is shown ONLY in aggregate
// reports (Gap Finder), never to the resident.

export interface CompanionOption {
  labelKey: string;
  next: string;
}

export interface CompanionNode {
  id: string;
  promptKey: string;
  options: CompanionOption[];
  freeText?: boolean;
  terminal?: 'calm' | 'human' | 'checkin';
  moodTag?: 'steady' | 'heavy' | 'unsure';
}

export const COMPANION_TREE: Record<string, CompanionNode> = {
  start: {
    id: 'start',
    promptKey: 'startPrompt',
    options: [
      { labelKey: 'optOkay', next: 'steady' },
      { labelKey: 'optHeavy', next: 'heavy' },
      { labelKey: 'optUnsure', next: 'unsure' },
    ],
  },
  steady: {
    id: 'steady',
    promptKey: 'steadyPrompt',
    moodTag: 'steady',
    options: [
      { labelKey: 'optBreathe', next: 'end_calm' },
      { labelKey: 'optCheckin', next: 'end_checkin' },
      { labelKey: 'optTalk', next: 'end_human' },
    ],
  },
  heavy: {
    id: 'heavy',
    promptKey: 'heavyPrompt',
    moodTag: 'heavy',
    options: [
      { labelKey: 'optWords', next: 'words' },
      { labelKey: 'optBreathe', next: 'end_calm' },
      { labelKey: 'optHuman', next: 'end_human' },
    ],
  },
  unsure: {
    id: 'unsure',
    promptKey: 'unsurePrompt',
    moodTag: 'unsure',
    options: [
      { labelKey: 'optWords', next: 'words' },
      { labelKey: 'optGrounding', next: 'end_calm' },
      { labelKey: 'optCheckin', next: 'end_checkin' },
    ],
  },
  words: {
    id: 'words',
    promptKey: 'wordsPrompt',
    freeText: true,
    options: [
      { labelKey: 'optCalm', next: 'end_calm' },
      { labelKey: 'optHuman', next: 'end_human' },
    ],
  },
  end_calm: { id: 'end_calm', promptKey: 'endCalm', options: [], terminal: 'calm' },
  end_human: { id: 'end_human', promptKey: 'endHuman', options: [], terminal: 'human' },
  end_checkin: { id: 'end_checkin', promptKey: 'endCheckin', options: [], terminal: 'checkin' },
};

export const SESSION_STEP_CAP = 8;

export function sessionOver(steps: number): boolean {
  return steps >= SESSION_STEP_CAP;
}

export function scanFreeText(text: string): CrisisResult {
  return detectCrisis('PHQ9', [0, 0, 0, 0, 0, 0, 0, 0, 0], text);
}

export function moodFromPath(path: string[]): 'steady' | 'heavy' | 'unsure' | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const tag = COMPANION_TREE[path[i]]?.moodTag;
    if (tag) return tag;
  }
  return null;
}