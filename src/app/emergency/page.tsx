import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EMERGENCY_CONFIG } from '@/config/emergency';
import { SyntheticBadge } from '@/components/header';

// Full-screen emergency page — fixed rules, never AI (hard rule 3).
export default async function EmergencyPage() {
  const t = await getTranslations('emergency');
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-red-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-red-800">{t('title')}</h1>
        </div>
        <div className="mt-2"><SyntheticBadge /></div>

        <div className="card mt-5 border-red-200 p-5">
          <ul className="space-y-3 text-sm leading-relaxed">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i}>{t(`guidance.${i}`)}</li>
            ))}
          </ul>
        </div>

        <div className="card mt-4 border-red-200 p-5">
          <h2 className="font-semibold text-red-800">{t('contacts')}</h2>
          <p className="mt-1 rounded bg-amber-100 p-2 text-xs font-semibold text-amber-900">
            {EMERGENCY_CONFIG.verificationNotice}
          </p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-medium">{t('ambulance')}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.ambulance.number}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('mentalHealthLine')}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.mentalHealthLine.number}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('emergencyDepartment')}</dt>
              <dd className="text-muted">{EMERGENCY_CONFIG.emergencyDepartment.number}</dd>
            </div>
          </dl>
        </div>

        <a href="#human" className="btn btn-danger mt-5 w-full text-lg">
          {t('talkToHuman')}
        </a>

        <div id="human" className="card mt-4 border-red-200 p-5 text-sm">
          <h2 className="font-semibold">{t('humanAlerted')}</h2>
          <p className="mt-2 text-muted">{t('humanAlertedBody')}</p>
          <Link href="/navigator" className="btn btn-outline mt-3 w-full">
            {t('openNavigator')}
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted">{t('footerNote')}</p>
      </div>
    </div>
  );
}