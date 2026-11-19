import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function Home() {
  const t = await getTranslations('home');
  return (
    <div className="space-y-8">
      <section className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-muted">{t('intro')}</p>
        <p className="mt-2 text-sm text-muted">{t('note')}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/resident" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">{t('residentTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('residentDesc')}</p>
        </Link>
        <Link href="/navigator" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">{t('navigatorTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('navigatorDesc')}</p>
        </Link>
        <Link href="/health-system" className="card block p-5 hover:border-teal-600">
          <h2 className="font-semibold text-teal-800">{t('healthTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('healthDesc')}</p>
        </Link>
      </div>
    </div>
  );
}