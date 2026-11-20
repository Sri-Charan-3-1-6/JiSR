import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('summary');
  return { title: `${t('title')} — JISR` };
}

export default function SummaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}