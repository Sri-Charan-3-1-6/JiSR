import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PortalShell } from '@/components/ui/sidebar';
import { operatorSidebarItems } from '@/lib/sidebar-items';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('employer');
  return { title: `${t('title')} — JISR` };
}

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const items = await operatorSidebarItems();
  return (
    <PortalShell items={items} homeLabel={t('home')}>
      {children}
    </PortalShell>
  );
}