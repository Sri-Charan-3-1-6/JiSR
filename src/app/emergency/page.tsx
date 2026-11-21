import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EMERGENCY_CONTACTS } from '@/config/emergency';
import { SyntheticBadge } from '@/components/header';
import EmergencyOverlay from '@/components/emergency-overlay';

// Full-screen emergency page — fixed rules, never AI (hard rule 3).
// Calm by design: soft colours, slow breathing cue, no flashing.
export default async function EmergencyPage() {
  const t = await getTranslations('emergency');
  return (
    <EmergencyOverlay>
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
            <span className="breathe absolute inset-0 rounded-pill bg-primary/15" />
            <span className="absolute inset-3 rounded-pill bg-primary/15" />
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="relative text-primary">
              <path
                d="M12 21 C7 17 3.5 13.5 3.5 9.5 C3.5 6.5 5.8 4.5 8.5 4.5 C10 4.5 11.3 5.2 12 6.3 C12.7 5.2 14 4.5 15.5 4.5 C18.2 4.5 20.5 6.5 20.5 9.5 C20.5 13.5 17 17 12 21 Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-danger">{t('title')}</h1>
          <div className="mt-3"><SyntheticBadge /></div>
        </div>

        <div className="card mt-6 p-6">
          <ul className="space-y-4 text-base leading-relaxed">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-primary" aria-hidden="true" />
                {t(`guidance.${i}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="card mt-4 p-6">
          <h2 className="font-bold">{t('contacts')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {EMERGENCY_CONTACTS.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 rounded-btn bg-surface-2 p-3">
                <dt className="font-semibold">{t(c.key)}</dt>
                <dd>
                  <a
                    href={`tel:${c.tel}`}
                    className="font-mono text-base font-semibold text-primary underline-offset-2 hover:underline"
                    aria-label={`${t(c.key)} — ${t('tapToCall')} ${c.number}`}
                  >
                    {c.number}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('sourceNote')}</p>
        </div>

        <a href="#human" className="btn btn-danger mt-6 w-full text-lg" style={{ minHeight: 56 }}>
          {t('talkToHuman')}
        </a>

        <div id="human" className="card mt-4 p-6 text-sm">
          <h2 className="font-bold text-success">{t('humanAlerted')}</h2>
          <p className="mt-2 leading-relaxed text-muted">{t('humanAlertedBody')}</p>
          <Link href="/navigator" className="btn btn-outline mt-4 w-full">
            {t('openNavigator')}
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-muted">{t('footerNote')}</p>
      </div>
    </EmergencyOverlay>
  );
}