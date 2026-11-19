// Pre-generates every (instrument x band x language) explanation into the
// shared cache so live requests are served without an LLM call.
// Run: npx tsx --env-file=.env.local scripts/pregenerate-explanations.ts
import { query } from '../src/lib/db';
import { explainTemplate, type Instrument, type Language } from '../src/lib/explain';
import { breakerRemainingMs, generateExplanation } from '../src/lib/llm/client';

const INSTRUMENTS: Instrument[] = ['PHQ9', 'GAD7'];
const BANDS = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];
const LANGUAGES: Language[] = ['en', 'ar', 'hi'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let llm = 0;
  let tpl = 0;
  for (const instrument of INSTRUMENTS) {
    for (const band of BANDS) {
      for (const language of LANGUAGES) {
        const input = { instrument, total: 0, band, language };
        // Respect the circuit breaker instead of burning rows as templates.
        const wait = breakerRemainingMs();
        if (wait > 0 && band !== 'crisis') {
          console.log(`breaker open — waiting ${Math.ceil(wait / 1000)}s`);
          await sleep(wait + 1000);
        }
        const r =
          band === 'crisis'
            ? { text: explainTemplate(input), source: 'template' as const, model: undefined }
            : await generateExplanation(input);
        await query(
          `insert into explanation_cache (instrument, band, language, text, source, model)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (instrument, band, language)
           do update set text = excluded.text, source = excluded.source,
                         model = excluded.model, created_at = sim_now()
           where explanation_cache.source <> 'llm' or excluded.source = 'llm'`,
          [instrument, band, language, r.text, r.source, r.model ?? null],
        );
        if (r.source === 'llm') llm++;
        else tpl++;
        console.log(`${instrument} ${band} ${language} -> ${r.source}${r.model ? ` (${r.model})` : ''}`);
        // Pace requests to stay under free-tier per-minute limits.
        if (band !== 'crisis') await sleep(3000);
      }
    }
  }
  console.log(`done: ${llm} llm, ${tpl} template, ${llm + tpl} total rows processed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});