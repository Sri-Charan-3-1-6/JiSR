'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { itemsFor, ANSWER_OPTIONS, type Instrument } from '@/lib/scoring';

export default function ScreenClient({ instrument: raw }: { instrument: string }) {
  const instrument = (raw === 'GAD7' ? 'GAD7' : 'PHQ9') as Instrument;
  const items = itemsFor(instrument);
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = items.length + 1; // + optional free-text screen
  const progress = Math.round((step / totalSteps) * 100);

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
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
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
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted">
          <span>{instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} · over the last 2 weeks</span>
          <span>{Math.min(step + 1, totalSteps)} / {totalSteps}</span>
        </div>
        <div
          className="mt-1 h-2 rounded-full bg-border"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-2 rounded-full bg-teal-700 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step < items.length ? (
        <section className="card p-6">
          <h1 className="text-lg font-semibold leading-snug">{items[step]}</h1>
          <div className="mt-5 grid gap-3">
            {ANSWER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => answer(opt.value)}
                className="btn btn-outline w-full justify-start text-left text-base"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button
              onClick={() => { setAnswers(answers.slice(0, -1)); setStep(step - 1); }}
              className="mt-4 text-sm text-muted underline"
            >
              Back
            </button>
          )}
        </section>
      ) : (
        <section className="card p-6">
          <h1 className="text-lg font-semibold">Anything else you want to share? (optional)</h1>
          <p className="mt-1 text-sm text-muted">
            Free text is checked by fixed safety rules. You can skip this.
          </p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={4}
            className="mt-4 w-full rounded-lg border border-border p-3 text-base"
            placeholder="Optional…"
          />
          {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
          <div className="mt-4 grid gap-3">
            <button
              onClick={() => submit(true)}
              disabled={submitting}
              className="btn btn-primary w-full"
            >
              {submitting ? 'Scoring…' : 'See my result'}
            </button>
            <button
              onClick={() => submit(false)}
              disabled={submitting}
              className="btn btn-outline w-full"
            >
              Skip and see my result
            </button>
          </div>
        </section>
      )}
    </div>
  );
}