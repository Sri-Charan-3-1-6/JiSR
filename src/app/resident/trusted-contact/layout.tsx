import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contact');
  return { title: `${t('metaTitle')} — JISR` };
}

export default function TrustedContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}