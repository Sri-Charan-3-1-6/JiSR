import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          JISR — a bridge from screening to real human support
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          JISR (&ldquo;bridge&rdquo; in Arabic) closes the gap between a positive mental-health
          screen and real human follow-up. It is not a chatbot and not a mood tracker:
          validated screening tools, fixed safety rules, and a human care navigator.
        </p>
        <p className="mt-2 text-sm text-muted">
          This is a screening, not a diagnosis. All data in this prototype is synthetic.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/resident" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">Resident app</h2>
          <p className="mt-2 text-sm text-muted">
            Take a PHQ-9 or GAD-7 screen, see what your result means, and get matched to
            the right level of support.
          </p>
        </Link>
        <Link href="/navigator" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">Navigator console</h2>
          <p className="mt-2 text-sm text-muted">
            Human care navigator queue: risk-first ordering, SLA timers, overdue
            detection, outreach logging.
          </p>
        </Link>
        <Link href="/health-system" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">Health-System dashboard</h2>
          <p className="mt-2 text-sm text-muted">
            Gap Finder: where follow-up falls through, by language, age, gender,
            nationality and area. (Layer 2)
          </p>
        </Link>
      </div>
    </div>
  );
}