export default function HealthSystemPage() {
  return (
    <div className="mx-auto max-w-xl card p-6">
      <h1 className="text-xl font-bold">Health-System dashboard — Gap Finder</h1>
      <p className="mt-3 text-sm text-muted">
        The Gap Finder (screen-to-match conversion, SLA adherence, fairness gaps by language,
        age band, gender, nationality and area, with small-cell suppression) is built in
        Layer 2. The database schema and seed structure already support it.
      </p>
      <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        Not available yet in Layer 1 — this page is an honest placeholder, not a finished dashboard.
      </p>
    </div>
  );
}