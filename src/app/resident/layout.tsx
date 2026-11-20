import { getTranslations } from 'next-intl/server';
import { BottomNav } from '@/components/ui/bottom-nav';

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const items = [
    { href: '/resident', label: t('home'), icon: 'home' as const },
    { href: '/resident/consent', label: t('consent'), icon: 'consent' as const },
    { href: '/resident/summary', label: t('summary'), icon: 'summary' as const },
    { href: '/resident/wearable', label: t('wearable'), icon: 'wearable' as const },
  ];
  return (
    <div className="pb-16 md:pb-0">
      {children}
      <BottomNav items={items} />
    </div>
  );
}