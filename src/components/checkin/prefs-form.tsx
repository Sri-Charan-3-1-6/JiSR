'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { ReminderPrefs } from '@/lib/reminders';

export function PrefsForm({
  residentId,
  prefs,
  onSaved,
}: {
  residentId: string;
  prefs: ReminderPrefs;
  onSaved: (p: ReminderPrefs) => void;
}) {
  const t = useTranslations('checkin');
  const tc = useTranslations('common');
  const toast = useToast();
  const [draft, setDraft] = useState<ReminderPrefs>(prefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ReminderPrefs>(key: K, value: ReminderPrefs[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/residents/${residentId}/reminder-prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      onSaved(d.prefs);
      toast(t('saved'));
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const timeField = (key: 'remindAt' | 'quietStart' | 'quietEnd', label: string) => (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="time"
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        className="input mt-1 w-full"
      />
    </label>
  );

  const numField = (
    key: 'maxPerDay' | 'snoozeMinutes' | 'ladderGapMinutes' | 'ladderMissLimit',
    label: string,
    min: number,
    max: number,
  ) => (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft[key]}
        onChange={(e) => set(key, Number(e.target.value))}
        className="input mt-1 w-full"
      />
    </label>
  );

  return (
    <section className="card p-6">
      <h2 className="font-bold">{t('prefsTitle')}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {timeField('remindAt', t('remindAt'))}
        {numField('maxPerDay', t('maxPerDay'), 1, 10)}
        {timeField('quietStart', t('quietStart'))}
        {timeField('quietEnd', t('quietEnd'))}
        {numField('snoozeMinutes', t('snoozeMinutes'), 5, 240)}
        {numField('ladderGapMinutes', t('ladderGap'), 15, 1440)}
        {numField('ladderMissLimit', t('ladderMissLimit'), 2, 7)}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{t('vibration')}</p>
          <p className="mt-0.5 text-xs text-muted">{t('vibrationHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.vibration}
          aria-label={t('vibration')}
          onClick={() => set('vibration', !draft.vibration)}
          className={`relative mt-1 h-8 w-[52px] shrink-0 rounded-pill transition-colors duration-250 ${
            draft.vibration ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`absolute start-1 top-1 h-6 w-6 rounded-pill bg-white shadow-1 transition-transform duration-250 ${
              draft.vibration ? 'translate-x-[20px] rtl:-translate-x-[20px]' : ''
            }`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">{error}</p>
      )}
      <Button onClick={save} disabled={busy} className="mt-4">
        {busy ? tc('saving') : t('save')}
      </Button>
    </section>
  );
}