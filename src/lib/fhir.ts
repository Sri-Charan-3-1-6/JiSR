// FHIR-shaped export (R4-style resources). "Interoperability-ready", NOT
// certified or validated against any real system. Synthetic data only.

export interface ScreeningRow {
  instrument: string;
  answers: number[];
  total_score: number;
  band: string;
  created_at: string;
}
export interface HealthFlagsRow {
  physical_conditions: string[];
  sleep_flag: boolean;
  pain_flag: boolean;
}

const QUESTIONNAIRE: Record<string, { reference: string; display: string; items: number }> = {
  PHQ9: { reference: 'Questionnaire/phq-9', display: 'Patient Health Questionnaire-9', items: 9 },
  GAD7: { reference: 'Questionnaire/gad-7', display: 'Generalized Anxiety Disorder-7', items: 7 },
};

export function buildFhirBundle(
  pseudoId: string,
  screenings: ScreeningRow[],
  flags: HealthFlagsRow | null,
) {
  const subject = { identifier: { system: 'urn:jisr:pseudo-id', value: pseudoId } };
  const entry: object[] = [];

  for (const s of screenings) {
    const q = QUESTIONNAIRE[s.instrument] ?? QUESTIONNAIRE.PHQ9;
    entry.push({
      resource: {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        questionnaire: q.reference,
        subject,
        authored: s.created_at,
        item: s.answers.slice(0, q.items).map((a, i) => ({
          linkId: String(i + 1),
          answer: [{ valueInteger: a }],
        })),
      },
    });
    entry.push({
      resource: {
        resourceType: 'Observation',
        status: 'final',
        code: { text: `${q.display} total score` },
        subject,
        effectiveDateTime: s.created_at,
        valueInteger: s.total_score,
        interpretation: [{ text: `screening band: ${s.band} (not a diagnosis)` }],
      },
    });
  }

  if (flags) {
    for (const condition of flags.physical_conditions) {
      entry.push({
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: { text: 'Self-reported physical condition' },
          subject,
          valueString: condition,
        },
      });
    }
    entry.push({
      resource: {
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Self-reported sleep difficulty flag' },
        subject,
        valueBoolean: flags.sleep_flag,
      },
    });
    entry.push({
      resource: {
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Self-reported pain flag' },
        subject,
        valueBoolean: flags.pain_flag,
      },
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    meta: {
      tag: [
        { system: 'urn:jisr:prototype', code: 'synthetic', display: 'Synthetic prototype data' },
        { system: 'urn:jisr:prototype', code: 'interoperability-ready', display: 'Interoperability-ready, not certified' },
      ],
    },
    entry,
  };
}