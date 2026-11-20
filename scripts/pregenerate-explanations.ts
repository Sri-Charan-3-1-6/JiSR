// Pre-generates every (instrument x band x language) explanation into the
// shared cache so live requests are served without an LLM call.
// Run: npx tsx --env-file=.env.local scripts/pregenerate-explanations.ts
import { one, query } from '../src/lib/db';
import { explainTemplate, type Instrument, type Language } from '../src/lib/explain';
import { breakerRemainingMs, generateExplanation, resetBreaker } from '../src/lib/llm/client';
import { validateExplanation } from '../src/lib/llm/validate';

const INSTRUMENTS: Instrument[] = ['PHQ9', 'GAD7'];
const BANDS = ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'];
const LANGUAGES: Language[] = ['en', 'ar', 'hi'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let llm = 0;
  let tpl = 0;
  let streak = 0;
  let llmDisabled = false;
  for (const instrument of INSTRUMENTS) {
    for (const band of BANDS) {
      for (const language of LANGUAGES) {
        const input = { instrument, total: 0, band, language };
        // Keep an existing LLM row only if it still passes the current guard.
        const existing = await one<{ text: string; source: string; model: string | null }>(
          `select text, source, model from explanation_cache
           where instrument = $1 and band = $2 and language = $3`,
          [instrument, band, language],
        );
        if (existing?.source === 'llm' && validateExplanation(existing.text, language)) {
          console.log(`${instrument} ${band} ${language} -> kept (${existing.model})`);
          llm++;
          streak = 0;
          continue;
        }
        // Free-tier per-minute quotas recover in ~1 min; a batch run pauses
        // briefly and resets the breaker instead of sitting out the full 5 min.
        const wait = breakerRemainingMs();
        if (wait > 0 && band !== 'crisis' && !llmDisabled) {
          const pause = Math.min(wait, 65000);
          console.log(`breaker open — pausing ${Math.ceil(pause / 1000)}s, then resetting breaker`);
          await sleep(pause + 1000);
          resetBreaker();
        }
        const r =
          band === 'crisis' || llmDisabled
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
        if (r.source === 'llm') {
          llm++;
          streak = 0;
        } else {
          tpl++;
          if (band !== 'crisis' && !llmDisabled) {
            streak++;
            if (streak >= 8) {
              llmDisabled = true;
              console.log('8 consecutive template results — storing templates for the remaining combinations');
            }
          }
        }
        console.log(`${instrument} ${band} ${language} -> ${r.source}${r.model ? ` (${r.model})` : ''}`);
        // Pace requests to stay under free-tier per-minute limits.
        if (band !== 'crisis' && !llmDisabled) await sleep(4000);
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