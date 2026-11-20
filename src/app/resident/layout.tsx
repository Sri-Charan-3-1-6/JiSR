import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/ui/bottom-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('resident');
  return { title: `${t('title')} — JISR`, description: t('intro') };
}

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/resident', label: t('home'), icon: 'home' as const },
    { href: '/resident/checkin', label: t('checkin'), icon: 'checkin' as const },
    { href: '/resident/consent', label: t('consent'), icon: 'consent' as const },
    { href: '/resident/summary', label: t('summary'), icon: 'summary' as const },
    { href: '/resident/wearable', label: t('wearable'), icon: 'wearable' as const },
  ];
  return (
    <div className="pb-16 md:pb-0">
      <BottomNav items={items} />
      {children}
    </div>
  );
}