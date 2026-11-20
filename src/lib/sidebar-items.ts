import { getTranslations } from 'next-intl/server';
import type { SidebarItem } from '@/components/ui/sidebar';

export async function operatorSidebarItems(): Promise<SidebarItem[]> {
  const t = await getTranslations('nav');
  return [
    { href: '/navigator', label: t('navigator'), icon: 'queue' },
    { href: '/health-system', label: t('healthSystem'), icon: 'chart' },
    { href: '/employer', label: t('employer'), icon: 'building' },
  ];
}