'use client';

import { useEffect, useState } from 'react';

interface GroupCount {
  group_value: string;
  resident_count: string;
}
interface Totals {
  screenings_total: string;
  crisis_screens_total: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];
const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const AREAS = ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5'];
const NATIONALITIES = ['Group A', 'Group B', 'Group C', 'Group D', 'Group S'];

function CountTable({ title, labels, rows }: {
  title: string;
  labels: { value: string; label: string }[];
  rows: GroupCount[];
}) {
  const byValue = new Map(rows.map((r) => [r.group_value, r.resident_count]));
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-1.5">Group</th>
            <th className="py-1.5 text-right">Residents</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l) => {
            const count = byValue.get(l.value);
            return (
              <tr key={l.value} className="border-b border-border/60">
                <td className="py-1.5">{l.label}</td>
                <td className="py-1.5 text-right font-mono">
                  {count === undefined ? (
                    <span
                      className="text-muted"
                      title="Suppressed: fewer than 10 people in this group"
                    >
                      &lt;10
                    </span>
                  ) : (
                    count
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployerPage() {
  const [areas, setAreas] = useState<GroupCount[]>([]);
  const [languages, setLanguages] = useState<GroupCount[]>([]);
  const [ages, setAges] = useState<GroupCount[]>([]);
  const [nationalities, setNationalities] = useState<GroupCount[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employer')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setAreas(d.areas);
        setLanguages(d.languages);
        setAges(d.ages);
        setNationalities(d.nationalities);
        setTotals(d.totals);
      })
      .catch(() => setError('Could not load aggregate data. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">Employer view — anonymous aggregates only</h1>
        <p className="mt-3 rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm font-medium text-teal-900">
          No identifiable wellbeing data is ever shown to employers.
        </p>
        <p className="mt-3 text-sm text-muted">
          Only anonymous counts are available on this page. Groups under 10 are hidden to
          protect privacy and shown as &ldquo;&lt;10&rdquo;. Individual scores, cases and crisis
          information are never exposed here. Counts include only residents who consented to
          anonymous aggregate statistics.
        </p>
      </section>

      {loading ? (
        <section className="card p-6 text-sm text-muted">Loading…</section>
      ) : error ? (
        <section role="alert" className="card border-danger p-6 text-sm text-danger">
          {error}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Screenings completed (total)
              </p>
              <p className="mt-1 text-2xl font-bold">{totals?.screenings_total ?? '—'}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Residents in programme
              </p>
              <p className="mt-1 text-2xl font-bold">
                {areas.reduce((s, r) => s + Number(r.resident_count), 0) || '—'}
              </p>
              <p className="mt-1 text-xs text-muted">Suppressed groups are not counted here.</p>
            </div>
          </section>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CountTable title="By language" labels={LANGUAGES} rows={languages} />
            <CountTable
              title="By age band"
              labels={AGE_BANDS.map((v) => ({ value: v, label: v }))}
              rows={ages}
            />
            <CountTable
              title="By area"
              labels={AREAS.map((v) => ({ value: v, label: v }))}
              rows={areas}
            />
            <CountTable
              title="By nationality"
              labels={NATIONALITIES.map((v) => ({ value: v, label: v }))}
              rows={nationalities}
            />
          </section>
        </>
      )}
    </div>
  );
}