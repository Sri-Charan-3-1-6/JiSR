import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('result');
  return { title: `${t('metaTitle')} — JISR` };
}

export default function ResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}