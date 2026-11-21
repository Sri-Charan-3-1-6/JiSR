'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { SESSION_STEP_CAP, scanFreeText, sessionOver } from '@/lib/companion';

type Outcome = 'calm' | 'human' | 'checkin' | 'crisis' | 'capped';
type MoodTag = 'steady' | 'heavy' | 'unsure';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  source?: 'llm' | 'fallback' | 'local';
}

const STARTERS: { labelKey: string; mood: MoodTag }[] = [
  { labelKey: 'optOkay', mood: 'steady' },
  { labelKey: 'optHeavy', mood: 'heavy' },
  { labelKey: 'optUnsure', mood: 'unsure' },
];

export default function CompanionPage() {
  const t = useTranslations('companion');
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: t('greeting'), source: 'local' },
  ]);
  const [input, setInput] = useState('');
  const [steps, setSteps] = useState(0);
  const [moodTag, setMoodTag] = useState<MoodTag | null>(null);
  const [ended, setEnded] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const recorded = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Session metrics are recorded once; the mood tag is SELF-REPORTED (starter
  // chip), never AI-derived, and travels only to aggregate reports.
  async function record(outcome: Outcome, crisisFlag = false, stepCount = steps) {
    if (recorded.current) return;
    recorded.current = true;
    const residentId = localStorage.getItem('jisr_resident_id');
    if (!residentId) return;
    try {
      await fetch('/api/companion/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId, steps: stepCount, outcome, moodTag, crisisFlag,
        }),
      });
    } catch {
      // Recording is best-effort; the conversation itself never depends on it.
    }
  }

  async function crisisRoute(text: string, stepCount: number) {
    setBusy(true);
    const residentId = localStorage.getItem('jisr_resident_id');
    try {
      const r = await fetch('/api/screenings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: 'PHQ9',
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          freeText: text,
          residentId,
        }),
      });
      const d = await r.json();
      if (d.residentId) localStorage.setItem('jisr_resident_id', d.residentId);
      await record('crisis', true, stepCount);
      router.push(`/emergency?caseId=${d.caseId}`);
    } catch {
      // Even if the API is unreachable, emergency guidance must open.
      await record('crisis', true, stepCount);
      router.push('/emergency');
    }
  }

  async function send(raw: string, mood?: MoodTag) {
    const text = raw.trim();
    if (busy || ended || !text) return;
    if (mood) setMoodTag(mood);
    const nextSteps = steps + 1;
    setSteps(nextSteps);
    setInput('');
    const history: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(history);

    // Fixed local crisis scan FIRST — crisis text never leaves this device
    // for an AI reply, even when offline.
    if (scanFreeText(text).crisis) {
      await crisisRoute(text, nextSteps);
      return;
    }

    setBusy(true);
    let reply: ChatMsg;
    try {
      const r = await fetch('/api/companion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: locale,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const d = await r.json();
      if (d.crisis) {
        await crisisRoute(text, nextSteps);
        return;
      }
      reply = {
        role: 'assistant',
        content: typeof d.text === 'string' && d.text ? d.text : t('offlineReply'),
        source: d.source === 'llm' ? 'llm' : 'fallback',
      };
    } catch {
      reply = { role: 'assistant', content: t('offlineReply'), source: 'fallback' };
    }
    setMessages((m) => [...m, reply]);
    setBusy(false);
    if (sessionOver(nextSteps)) {
      setEnded('capped');
      await record('capped', false, nextSteps);
    }
  }

  async function talkToHuman() {
    if (busy) return;
    await record('human');
    router.push('/navigator');
  }

  function restart() {
    recorded.current = false;
    setMessages([{ role: 'assistant', content: t('greeting'), source: 'local' }]);
    setInput('');
    setSteps(0);
    setMoodTag(null);
    setEnded(null);
    setBusy(false);
  }

  const showStarters = messages.length === 1 && !ended && !busy;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="surface-hero p-6 sm:p-8">
        <h1 className="page-heading">{t('title')}</h1>
        <p className="mt-5 rounded-btn border border-warning/25 bg-warning-soft p-4 text-sm leading-relaxed text-warning">
          {t('disclaimer')}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button onClick={talkToHuman} variant="outline" className="text-sm text-primary-strong">
            {t('human')}
          </Button>
          <span className="eyebrow text-muted">{t('stepCap', { k: Math.min(steps + 1, SESSION_STEP_CAP), n: SESSION_STEP_CAP })}</span>
        </div>
      </section>

      <section className="data-panel p-6 sm:p-8">
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={t('title')}
          className="max-h-[26rem] space-y-4 overflow-y-auto pe-1"
        >
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-card rounded-ee-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground'
                    : 'max-w-[85%] rounded-card rounded-es-sm bg-surface-2/80 px-4 py-3 text-sm leading-relaxed'
                }
              >
                {m.role === 'assistant' && (m.source === 'llm' || m.source === 'fallback') && (
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-accent">
                    {m.source === 'llm' ? t('aiBadge') : t('fallbackNote')}
                  </span>
                )}
                {m.content}
              </div>
            </motion.div>
          ))}
          {busy && (
            <div className="flex justify-start" aria-hidden="true">
              <div className="rounded-card rounded-es-sm bg-surface-2/80 px-4 py-3 text-sm text-muted">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-muted" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-muted [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-muted [animation-delay:300ms]" />
                </span>
                <span className="sr-only">{t('thinking')}</span>
              </div>
            </div>
          )}
        </div>

        {showStarters && (
          <div className="mt-5 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Button
                key={s.labelKey}
                onClick={() => send(t(s.labelKey), s.mood)}
                variant="outline"
                className="px-4 py-2 text-sm"
              >
                {t(s.labelKey)}
              </Button>
            ))}
          </div>
        )}

        {ended ? (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="section-heading">{t('endTitle')}</h2>
            <p className="mt-3 text-base leading-relaxed text-muted">{t('cappedNote')}</p>
            <p className="mt-2 text-base leading-relaxed text-muted">{t('endBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/resident/calm" className="btn btn-primary px-3 py-2 text-sm">{t('calmLink')}</Link>
              <Link href="/navigator" className="btn btn-outline px-3 py-2 text-sm">{t('human')}</Link>
              <Link href="/resident/checkin" className="btn btn-outline px-3 py-2 text-sm">{t('backToCheckin')}</Link>
              <Button onClick={restart} variant="ghost" className="px-3 py-2 text-sm">{t('restart')}</Button>
            </div>
          </div>
        ) : (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label className="block text-sm font-medium" htmlFor="companion-free-text">
              {t('freeTextLabel')}
            </label>
            <textarea
              id="companion-free-text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder={t('inputPlaceholder')}
              className="input mt-2 text-base"
              disabled={busy}
            />
            <p className="mt-1 text-xs text-muted">{t('freeTextHint')}</p>
            <p className="mt-1 text-xs text-muted">{t('crisisNote')}</p>
            <Button
              type="submit"
              disabled={busy || !input.trim()}
              className="mt-3 px-5 py-2 text-sm"
            >
              {t('send')}
            </Button>
          </form>
        )}
      </section>

      <section className="border-t border-border pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/resident/checkin" className="btn btn-outline px-3 py-2">{t('backToCheckin')}</Link>
          <Link href="/resident/calm" className="btn btn-outline px-3 py-2">{t('calmLink')}</Link>
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}