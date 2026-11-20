# Layer 5 — Check-in Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a consent-gated check-in companion (reminders + persistence ladder + calm corner + scripted companion + opt-in trusted contact) whose every event feeds the Gap Finder, with full audit and demo-story integration.

**Architecture:** New Postgres tables/views (migrations 013–016) behind the existing consent ledger (two new scopes); pure deterministic libs (`reminders`, `companion`, `trusted-contact`, `calm`) unit-tested without DB; Next.js route handlers enforce consent + quiet hours + caps server-side; resident UI reuses the existing design system; navigator queue gains escalation tasks; Gap Finder gains check-in views/cards; demo fetch-shim store answers all new routes.

**Tech Stack:** Next.js 16 App Router (PPR), React 19, TS, Tailwind v4 tokens, motion/react, next-intl (en/ar/hi), pg against Supabase Postgres with RLS, vitest + Playwright.

**Spec:** user Layer 5 directive (2026-11-20), hard rules below.

## Global Constraints

- NO camera use, NO facial analysis. Simple emotion tag allowed but visible ONLY in aggregate reports, never to the resident. Test bans `getUserMedia` / `mediaDevices` in shipped code.
- NO covert monitoring; nothing forces form completion; all consent explicit, granular, revocable in existing ledger; new scopes `reminders`, `trusted_contact`.
- Reminders: user-set schedule, quiet hours, snooze, max/day; ladder stops after limit, never loops.
- Calm corner: 3 offline exercises; supportive lines pre-written in DB per language with `reviewed` flag; never AI-generated; no toxic positivity, no prescribing feelings; jokes/memes OPT-IN, off by default.
- Companion: scripted decision tree, no LLM, no free text to external models; local crisis keyword scan → existing /emergency + CRITICAL case; session cap; "I'm not a replacement for a professional"; one-tap talk-to-human.
- Trusted contact: opt-in; only after navigator human call FAILED; generic message "[Name] asked us to let you know they'd appreciate a call."; never scores/results/mental-health wording; simulated send with "Simulated" badge + prefilled wa.me link; reply = "contact made" only, never changes risk.
- Every reminder/escalation/contact message in user audit log; revoking consent stops everything immediately.
- Every Layer 5 event in tables used by Gap Finder views; new views + cards: check-in completion rate, median time to re-engage after miss, share of escalations resolved by human; same splits (language, age_band, gender, nationality, area), same fairness flags (<80% of best) and n>=10 suppression; new events in demo story; every Layer 5 screen links to Follow-up Clock (/navigator) or Gap Finder (/health-system).
- Existing design system only: same tokens/components/motion (0.25–0.3s, ease [0.22,1,0.36,1], transform/opacity, useReducedMotion), RTL + reduced-motion.
- Carried hard rules: synthetic data + visible badge; pseudonymous IDs only; LLM never scores/matches/decides crisis; emergency numbers stay placeholders; parameterized SQL only; migrations must run against real Postgres with output proof; secrets never printed; `.env.local` never committed.
- Web Push: optional ("if time allows") — NOT implemented this layer; in-app notification center is real; Vibration API real, opt-in, only while app open. Honest note in README/checklist.

## File Structure

- Create `db/migrations/013_layer5_schema.sql`, `014_layer5_rls.sql`, `015_layer5_views.sql`, `016_seed_layer5.sql`
- Create `src/lib/reminders.ts`, `src/lib/companion.ts`, `src/lib/trusted-contact.ts`, `src/lib/calm.ts`
- Create `src/app/api/residents/[id]/reminder-prefs/route.ts`, `.../checkins/route.ts`, `.../checkins/evaluate/route.ts`, `.../notifications/route.ts`, `.../audit/route.ts`, `.../trusted-contact/route.ts`
- Create `src/app/api/checkins/[id]/complete/route.ts`, `.../snooze/route.ts`; `src/app/api/notifications/[id]/read/route.ts`
- Create `src/app/api/calm/lines/route.ts`, `src/app/api/calm/lines/[id]/route.ts`, `src/app/api/calm/sessions/route.ts`, `src/app/api/companion/sessions/route.ts`
- Create `src/app/api/navigator/tasks/route.ts`, `src/app/api/navigator/tasks/[id]/call/route.ts`
- Create `src/app/api/trusted-contact/[id]/send/route.ts`, `.../reply/route.ts`
- Modify `src/app/api/navigator/queue/route.ts`, `src/app/api/gapfinder/route.ts`
- Create `src/app/resident/checkin/page.tsx` + `layout.tsx`, `src/app/resident/companion/page.tsx` + `layout.tsx`, `src/app/resident/calm/page.tsx` + `layout.tsx`, `src/app/resident/trusted-contact/page.tsx` + `layout.tsx`
- Create `src/components/checkin/*` (prefs-form, notification-center, ladder-card), `src/components/calm/*` (breathing-circle, grounding-stepper, memory-match), `src/components/companion/tree-runner.tsx`, `src/components/contact/simulated-send.tsx`
- Modify `src/app/resident/consent/page.tsx` (SCOPES +2), `src/app/resident/page.tsx` (hub link), `src/components/ui/bottom-nav.tsx` items via `src/app/resident/layout.tsx`, `src/app/navigator/page.tsx` + navigator client (tasks), `src/app/health-system/page.tsx` (cards + fairness + faculty review), `src/lib/sidebar-items.ts` if needed
- Modify `src/lib/demo/story.ts`, `src/components/demo/demo-guide.tsx` (n=8), `messages/{en,ar,hi}.json`, `tests/demo-story.test.ts`, `e2e/demo.pw.ts`, `e2e/pwa.pw.ts`, `e2e/sweep.pw.ts`
- Create `tests/reminders.test.ts`, `tests/companion.test.ts`, `tests/trusted-contact.test.ts`, `tests/layer5.integration.test.ts`, `tests/no-camera.test.ts`, `e2e/layer5.pw.ts`
- Modify `README.md`

## Key interfaces (locked)

```ts
// src/lib/reminders.ts
export interface ReminderPrefs { remindAt: string; quietStart: string; quietEnd: string; maxPerDay: number; snoozeMinutes: number; ladderGapMinutes: number; ladderMissLimit: number; vibration: boolean }
export const DEFAULT_PREFS: ReminderPrefs; // 09:00, 22:00, 08:00, 3, 30, 120, 3, false
export const MAX_SENDS_PER_CHECKIN = 3;
export function inQuietHours(prefs: ReminderPrefs, at: Date): boolean; // wrap-around aware, minutes-of-day
export function capReached(sentToday: number, prefs: ReminderPrefs): boolean;
export type LadderAction = 'reminder' | 'soft_reminder' | 'escalate' | 'stop' | 'skip_quiet' | 'skip_cap';
export function decide(checkin: { state: string; dueAt: Date; remindersSent: number; consecutiveMisses: number }, prefs: ReminderPrefs, now: Date, sentToday: number): { action: LadderAction; missed: boolean };
// reminder at due (sent 0); missed+soft at due+gap (sent 1, misses<limit); escalate at misses>=limit (sent 2); else stop. quiet/cap checks first, never mutate.
export function snoozedDue(now: Date, minutes: number): Date;

// src/lib/companion.ts
export interface CompanionNode { id: string; promptKey: string; options: { labelKey: string; next: string }[]; freeText?: boolean; terminal?: 'calm' | 'human' | 'checkin'; moodTag?: 'steady' | 'heavy' | 'unsure' }
export const COMPANION_TREE: Record<string, CompanionNode>; // start, steady, heavy, unsure, words(freeText), end_calm, end_human, end_checkin
export const SESSION_STEP_CAP = 8;
export function scanFreeText(text: string): CrisisResult; // detectCrisis('PHQ9', [0,0,0,0,0,0,0,0,0], text)
export function sessionOver(steps: number): boolean;

// src/lib/trusted-contact.ts
export const CONTACT_TEMPLATE = "[Name] asked us to let you know they'd appreciate a call.";
export function buildContactMessage(handle: string): string; // [Name] -> pseudonymous handle
export function containsHealthData(msg: string): boolean; // forbidden: score, phq, gad, depress, anxie, mental, screening, result, crisis, symptom, therap, diagnos, mood, wellbeing
export function waLink(phone: string, msg: string): string; // https://wa.me/<digits>?text=<encoded>

// src/lib/calm.ts
export type Exercise = 'breathing' | 'grounding' | 'memory';
export const BREATHING_PHASES = [{ key: 'inhale', seconds: 4 }, { key: 'hold', seconds: 4 }, { key: 'exhale', seconds: 4 }, { key: 'hold2', seconds: 4 }];
export const GROUNDING_STEPS = [{ key: 'see', count: 5 }, { key: 'touch', count: 4 }, { key: 'hear', count: 3 }, { key: 'smell', count: 2 }, { key: 'taste', count: 1 }];
export const MEMORY_SYMBOLS = ['sun', 'moon', 'star', 'leaf', 'wave', 'hill']; // svg shapes, language-neutral
```

SQL views (015): `checkin_funnel` (per checkin + demographics + `reengage_hours` via lateral next completed), `gapfinder_checkin_metrics` (completion_rate, median_hours_to_reengage via percentile_cont, escalations_total, escalations_resolved_human = call reached OR contact_made, share), `gapfinder_checkin_fairness` (5 dimensions, n>=10 HAVING, best_completion window, is_gap < 0.8*best). `companion_sessions.mood_tag` surfaces ONLY as aggregate share in health-system report card.

---

### Task 1: Schema + RLS + views + seed (migrations 013–016)

**Files:** Create the four migrations; run `npm run db:migrate`.
**Interfaces:** Produces tables `reminder_prefs, companion_prefs, checkins, reminder_events, navigator_tasks, calm_lines, calm_sessions, companion_sessions, trusted_contacts, trusted_contact_events`; scopes `reminders`, `trusted_contact`; views above.

- [ ] Write 013: tables per File Structure with `sim_now()` defaults, checks (`max_per_day` 1–10, `snooze_minutes` 5–240, `ladder_gap_minutes` 15–1440, `ladder_miss_limit` 2–7, states/kinds enums), indexes on (resident_id, created_at/due_at). `checkins.state in ('pending','completed','missed','snoozed','stopped')`; `reminder_events.kind in ('reminder','soft_reminder','snoozed','completed','missed','escalated','stopped','skipped_quiet_hours','skipped_daily_cap')`; `navigator_tasks.call_outcome in ('reached','not_reached')` null allowed; `trusted_contact_events.kind in ('simulated_sent','contact_made')`; `companion_sessions(mood_tag in ('steady','heavy','unsure'), outcome, steps, crisis_flag)`.
- [ ] Write 014: drop/re-add `consent_scopes_scope_check` with 7 scopes; RLS force + select policies: reminder_prefs/checkins/reminder_events → `reminders`; navigator_tasks → `navigator_contact`; trusted_contacts/trusted_contact_events → `trusted_contact`; calm_sessions/companion_sessions → `store_results`; calm_lines select to jisr_app without consent (non-personal content); grants mirror 004.
- [ ] Write 015: the three views exactly per Key interfaces; suppression inside views.
- [ ] Write 016: `select setseed(0.5);` calm_lines 6 support + 3 joke per language (support: observational, non-prescribing, e.g. en "You showed up today. That counts."; ar "وجودك هنا اليوم خطوة بحد ذاتها."; hi "आज आप यहाँ आए। यह अपने आप में एक कदम है।"; jokes mild, no mocking); reviewed=true on 4 support lines per language with reviewed_by='faculty-demo'; prefs for 8 demo residents; consent grants reminders ~90% / trusted_contact ~30% of gapfinder residents; 6 checkins/resident over 30 days with language-correlated completion (en .85, ar .75, hi .55); missed→later completed for re-engage median; ~40 escalations from 3-miss streaks, half reached, quarter not_reached with trusted_contact events (consented only); demo residents get a pending + a missed checkin.
- [ ] Run `npm run db:migrate` and show output (proof). Run `node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/layer2.integration.test.ts` to prove no regression.
- [ ] Commit `feat(layer-5): schema, RLS, gapfinder views and synthetic seed for check-in companion`.

### Task 2: Pure libs + unit tests

**Files:** Create the four libs; Create `tests/reminders.test.ts`, `tests/companion.test.ts`, `tests/trusted-contact.test.ts`, `tests/no-camera.test.ts`.
**Interfaces:** Consumes `detectCrisis` from `src/lib/crisis.ts`; Produces locked interfaces above.

- [ ] Tests first: quiet hours wrap (22:00–08:00 at 23:30 true, 12:00 false, 07:59 true, 08:00 false); cap (3 sends → true); decide() sequence reminder→soft→escalate→stop and stop after MAX_SENDS_PER_CHECKIN; quiet/cap skip never increments; snooze math; tree: every `next` exists, terminals reachable, cap 8; scanFreeText hits en/ar/hi keywords and misses benign text; buildContactMessage exact template with handle; containsHealthData false for template, true for "your PHQ-9 score was 10"; waLink digits+encoding; no-camera: read every file under src/ and public/sw.js, fail on /getUserMedia|mediaDevices/.
- [ ] Run tests → FAIL (modules missing). Implement libs. Run → PASS.
- [ ] Commit `feat(layer-5): deterministic reminder ladder, companion tree, contact-message guard, calm constants`.

### Task 3: API routes + integration tests

**Files:** all routes in File Structure; modify queue + gapfinder routes; Create `tests/layer5.integration.test.ts`.
**Interfaces:** Consumes libs + `query/one` from `src/lib/db`; Produces JSON shapes: prefs `{prefs, consent}`; checkins `{checkins, consent}`; evaluate `{events, tasks}`; notifications `{events}`; audit `{consent, reminders, contact, calm, companion}`; tasks GET `{tasks}`; call POST `{task, eligibleContact}`; send POST `{message, waLink, simulated:true}`; reply POST `{ok, kind:'contact_made'}`; gapfinder adds `checkin:{metrics, fairness, suppressed}`; queue adds `tasks`.

- [ ] Integration tests (real Postgres, fresh resident per test): PUT prefs without consent → 403 consentRequired; with consent → 200; evaluate in quiet hours → skipped_quiet_hours and state unchanged; cap reached → skipped_daily_cap; ladder: due past + gap past + limit 2 → exactly reminder, soft_reminder, escalated then stopped, 4th evaluate adds nothing; revoke reminders → evaluate 403 and notifications 403; send without consent 403; send before failed call 403; after call not_reached → 200 message passes containsHealthData=false; second send same task 409; reply → contact_made, case risk_tier/state unchanged; calm sessions without store_results 403; views: fairness has no group n<10; audit contains reminder + contact rows.
- [ ] Implement routes with parameterized SQL only; consent checked server-side on every mutating and personal-data read; evaluate uses `decide()`; send guards consent+eligibility+message guard; reply never touches cases.
- [ ] Run integration + full vitest → PASS. Commit `feat(layer-5): consent-gated check-in, reminder, calm, companion and trusted-contact APIs`.

### Task 4: Resident UI + i18n + consent scopes

**Files:** 4 pages + layouts + components; modify consent page SCOPES, resident layout nav, resident home link; messages en/ar/hi new namespaces `checkin`, `companion`, `calm`, `contact` + additions to `consent`, `resident`, `nav`.
**Interfaces:** Consumes Task 3 JSON shapes; every page footer links: Follow-up Clock `/navigator` + Gap Finder `/health-system`.

- [ ] i18n keys first (identical sets): checkin.{metaTitle,title,intro,prefsTitle,remindAt,quietStart,quietEnd,maxPerDay,snoozeMinutes,ladderGap,ladderMissLimit,vibration,vibrationHint,save,saved,notificationsTitle,notificationsEmpty,markRead,ladderTitle,ladderBody,streak,nextStep,openCompanion,openCalm,openContact,clockLink,gapLink,auditTitle,consentRequired,consentLink,loading,error}; companion.{metaTitle,title,disclaimer,human,stepCap,freeTextLabel,freeTextHint,send,endTitle,endBody,backToCheckin,clockLink,crisisNote}; calm.{metaTitle,title,intro,breathing,grounding,memory,inhale,hold,exhale,see,touch,hear,smell,taste,start,stop,done,lineTitle,jokesToggle,jokesHint,offlineNote,reviewedNote,clockLink,gapLink,seconds}; contact.{metaTitle,title,intro,label,phone,phoneHint,save,consentRequired,consentLink,notEligible,eligibleTitle,simulatedBadge,send,waLink,reply,replyNote,eventsTitle,eventsEmpty,clockLink,gapLink,neverNote}; consent scopes reminders/trusted_contact titles+bodies; resident.checkinLink; nav.checkin.
- [ ] Pages: client components, SkeletonCard loading, honest error/empty states, motion stagger like existing pages, RTL-safe (ps/pe, text-start), reduced-motion respected. Checkin hub: prefs form (nothing forced — save optional), notification center with mark-read + vibration on new reminder only if prefs.vibration && document.visibilityState==='visible', ladder card, audit card, links. Companion: tree runner with step counter cap 8, free text scanned locally via scanFreeText → crisis: POST /api/screenings {instrument:'PHQ9', answers:[0×9], freeText} then router.push('/emergency'); disclaimer + human button always visible; session POST /api/companion/sessions {steps, outcome, moodTag} (moodTag never rendered). Calm: three exercises; breathing circle motion.scale [1,1.35,1,1.35] per phase with useReducedMotion fallback to phase text; grounding stepper; memory match 12 cards flip rotateY; lines fetched /api/calm/lines?language=.. cached localStorage `jisr_calm_lines_<lang>` for offline; jokes only when companion_prefs.jokes_opt_in; session POST. Trusted-contact: consent gate UI, form, simulated-send panel with Badge tone="warning" Simulated, wa.me anchor, reply button, events list, neverNote ("never includes scores or health wording").
- [ ] Metadata layouts (title — JISR) for 4 routes; consent SCOPES +2; BottomNav +checkin; resident home card link.
- [ ] `npm run build` + vitest i18n parity PASS; manual curl titles. Commit `feat(layer-5): resident check-in hub, companion, calm corner and trusted-contact screens`.

### Task 5: Navigator tasks + Gap Finder cards + faculty review

**Files:** modify navigator page/client, health-system page, gapfinder route (done T3), messages additions navigator.{tasksTitle,taskReason,logCall,reached,notReached,callNote,contactEligible,sendSimulated,replyMade}, health.{checkinTitle,checkinCompletion,checkinReengage,checkinEscalations,checkinFairnessTitle,companionReportTitle,companionHeavyShare,facultyTitle,facultyHint,reviewed,markReviewed,markUnreviewed}.
- [ ] Queue page: tasks section (Badge danger escalation), log-call dialog inline form outcome+note → POST call; when not_reached and consented contact exists: simulated-send panel (Badge Simulated + wa.me + reply). Case page unchanged.
- [ ] Health-system: three metric cards + check-in fairness table (same FairnessRow pattern, is_gap badge) + companion aggregate card (heavy share, labeled "aggregate report only") + faculty review card listing calm_lines with reviewed toggle (PATCH).
- [ ] Build + vitest + curl. Commit `feat(layer-5): navigator escalation tasks and Gap Finder check-in cards with faculty line review`.

### Task 6: Demo story extension (8 steps)

**Files:** modify story.ts, demo-guide.tsx (n=8), messages demo.s7*/s8*, tests/demo-story.test.ts, e2e/demo.pw.ts, e2e/pwa.pw.ts.
- [ ] Store: add prefs, checkins (one missed at day 12 + one pending), reminderEvents (reminder, soft_reminder, escalated), tasks (one checkin_escalation with call_outcome 'not_reached' seeded at day 12), contact (label 'Sister', synthetic phone '971500000000'), contactEvents, consent +reminders+trusted_contact true; CONSENT_SCOPES 7.
- [ ] handleDemoRequest: all Task 3 routes for demo ids (evaluate runs decide() on store; send/reply guard same rules; gapfinder GAPFINDER + checkin block with hi gap).
- [ ] DEMO_STEPS += {route:'/resident/checkin', day:12}, {route:'/resident/trusted-contact'}; guide n=8; s7 = missed check-in + ladder + notification, complete it; s8 = simulated trusted-contact message after failed call, record reply.
- [ ] Update vitest (8 steps, new route coverage, ladder stop in store, send guard) and e2e demo (steps 7–8 assertions + screenshots step-7/8 at both widths), pwa 'Step 1 of 8'.
- [ ] Full vitest + demo e2e local PASS. Commit `feat(layer-5): extend guided demo story to 8 steps with check-in and trusted-contact events`.

### Task 7: Layer 5 e2e + sweep + full verification

**Files:** Create e2e/layer5.pw.ts; modify e2e/sweep.pw.ts ROUTES (+4).
- [ ] e2e: consent reminders on → prefs save → quiet-hours-now evaluate shows skip badge; quiet window away → reminder in center + mark read; snooze; complete; ladder via API-seeded past-due checkin → escalation task visible in /navigator; log call not_reached; trusted_contact consent + contact save; send → Simulated badge + exact generic message + no health words; reply → contact made; calm breathing runs + line shown; jokes absent by default, present after opt-in; companion crisis text → /emergency; revoke reminders → center empty/403 state; audit card lists events. Zero console errors.
- [ ] Run full vitest + all e2e local. Commit `test(layer-5): end-to-end companion, ladder, contact and consent-revocation coverage`.

### Task 8: README + docs

- [ ] README: Layer 5 row, reminders/ladder/calm/companion/contact sections, new migrations 013–016 rows, new tests, limitations additions (no real Web Push, simulated contact send, emotion tag aggregate-only, no camera by design + ban test).
- [ ] Commit `docs(layer-5): README coverage and honest limitations`.

### Task 9: Preview, gates, merge, production

- [ ] Push layer-5; `npx vercel deploy --yes`; E2E_BASE_URL=<preview> full playwright; Lighthouse 5 routes gates (perf>=85, a11y>=95, medians of 3 if a single run dips); merge --ff-only to main only if all green; push; `npx vercel --prod --yes`; prod e2e demo/pwa/sweep/layer5; prod Lighthouse medians; commit reports via layer-5 ff-merge; final works/doesn't-work checklist with live link.

## Self-review notes

- Spec coverage: reminders(1)→T1-4; ladder(2)→T2,3,5; calm(3)→T1,2,4; companion(4)→T2,3,4; contact(5)→T2,3,4,5; audit(6)→T3,4; integration(7)→T1,5,6; tests→T2,3,7; deploy→T9. Web Push explicitly deferred (optional), Vibration implemented T4.
- Emotion rule: mood_tag stored, rendered only in health-system aggregate card; never in resident UI; no camera/face code; ban test T2.
- Type consistency: decide()/LadderAction, buildContactMessage/containsHealthData, COMPANION_TREE/SESSION_STEP_CAP used identically in T3/T6/T7.