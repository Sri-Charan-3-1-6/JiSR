import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('case');
  return { title: `${t('metaTitle')} — JISR` };
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}