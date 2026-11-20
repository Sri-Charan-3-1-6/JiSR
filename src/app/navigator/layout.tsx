import { getTranslations } from 'next-intl/server';
import { PortalShell } from '@/components/ui/sidebar';
import { operatorSidebarItems } from '@/lib/sidebar-items';

export default async function NavigatorLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const items = await operatorSidebarItems();
  return (
    <PortalShell items={items} homeLabel={t('home')}>
      {children}
    </PortalShell>
  );
}