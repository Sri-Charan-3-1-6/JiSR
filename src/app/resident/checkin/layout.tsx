import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkin');
  return { title: `${t('metaTitle')} — JISR` };
}

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return children;
}