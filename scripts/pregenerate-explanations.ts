// Pre-generates every (instrument x band x language) explanation into the
// shared cache so live requests are served without an LLM call.
// Run: npx tsx --env-file=.env.local scripts/pregenerate-explanations.ts
import { query } from '../src/lib/db';
import { explainTemplate, type Instrument, type Language } from '../src/lib/explain';
import { generateExplanation } from '../src/lib/llm/client';

const INSTRUMENTS: Instrument[] = ['PHQ9', 'GAD7'];
const BANDS = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];
const LANGUAGES: Language[] = ['en', 'ar', 'hi'];

async function main() {
  let llm = 0;
  let tpl = 0;
  for (const instrument of INSTRUMENTS) {
    for (const band of BANDS) {
      for (const language of LANGUAGES) {
        const input = { instrument, total: 0, band, language };
        const r =
          band === 'crisis'
            ? { text: explainTemplate(input), source: 'template' as const, model: undefined }
            : await generateExplanation(input);
        await query(
          `insert into explanation_cache (instrument, band, language, text, source, model)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (instrument, band, language)
           do update set text = excluded.text, source = excluded.source,
                         model = excluded.model, created_at = sim_now()`,
          [instrument, band, language, r.text, r.source, r.model ?? null],
        );
        if (r.source === 'llm') llm++;
        else tpl++;
        console.log(`${instrument} ${band} ${language} -> ${r.source}${r.model ? ` (${r.model})` : ''}`);
      }
    }
  }
  console.log(`done: ${llm} llm, ${tpl} template, ${llm + tpl} total rows upserted`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});