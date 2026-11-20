'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { itemsFor, ANSWER_OPTIONS, type Instrument } from '@/lib/scoring';

export default function ScreenClient({ instrument: raw }: { instrument: string }) {
  const instrument = (raw === 'GAD7' ? 'GAD7' : 'PHQ9') as Instrument;
  const items = itemsFor(instrument);
  const router = useRouter();
  const t = useTranslations('screen');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = items.length + 1; // + optional free-text screen
  const progress = Math.round((step / totalSteps) * 100);
  const itemKey = instrument === 'PHQ9' ? 'phq9' : 'gad7';

  function answer(value: number) {
    const next = [...answers, value];
    setAnswers(next);
    setError(null);
    setStep(step + 1);
  }

  async function submit(withText: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/screenings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument,
          answers,
          freeText: withText ? freeText : null,
          residentId: localStorage.getItem('jisr_resident_id'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('genericError'));
      localStorage.setItem('jisr_resident_id', data.residentId);
      if (data.crisis?.crisis) {
        router.push(`/emergency?caseId=${data.caseId}`);
      } else {
        router.push(`/resident/result/${data.caseId}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5">
        <div className="flex justify-between text-xs font-medium text-muted">
          <span>{instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} · {t('lastTwoWeeks')}</span>
          <span className="tabular-nums">{Math.min(step + 1, totalSteps)} / {totalSteps}</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-pill bg-surface-2"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full w-full origin-left rounded-pill rtl:origin-right"
            style={{ background: 'var(--gradient-brand)' }}
            initial={false}
            animate={{ scaleX: progress / 100 }}
            transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step < items.length ? (
          <motion.section
            key={`q${step}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="card p-6 sm:p-8"
          >
            <h1 className="text-xl font-bold leading-snug">{t(`${itemKey}.items.${step}`)}</h1>
            <div className="mt-6 grid gap-3">
              {ANSWER_OPTIONS.map((opt, i) => (
                <motion.button
                  key={opt.value}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  onClick={() => answer(opt.value)}
                  className="btn btn-outline w-full justify-start text-start text-base"
                >
                  {t(`answers.${opt.value}`)}
                </motion.button>
              ))}
            </div>
            {step > 0 && (
              <button
                onClick={() => { setAnswers(answers.slice(0, -1)); setStep(step - 1); }}
                className="mt-5 min-h-[44px] text-sm font-medium text-muted underline-offset-2 hover:underline"
              >
                {tc('back')}
              </button>
            )}
          </motion.section>
        ) : (
          <motion.section
            key="freetext"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="card p-6 sm:p-8"
          >
            <h1 className="text-xl font-bold">{t('freeTextTitle')}</h1>
            <p className="mt-2 text-sm text-muted">{t('freeTextHint')}</p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={4}
              className="input mt-4 text-base"
              placeholder={t('placeholder')}
            />
            {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-5 grid gap-3">
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.97 }}
                onClick={() => submit(true)}
                disabled={submitting}
                className="btn btn-primary w-full"
              >
                {submitting ? t('scoring') : t('seeResult')}
              </motion.button>
              <button
                onClick={() => submit(false)}
                disabled={submitting}
                className="btn btn-outline w-full"
              >
                {t('skip')}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}