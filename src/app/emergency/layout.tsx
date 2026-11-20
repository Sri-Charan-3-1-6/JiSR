import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('emergency');
  return { title: `${t('title')} — JISR` };
}

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}