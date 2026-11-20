import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ instrument: string }>;
}): Promise<Metadata> {
  const { instrument } = await params;
  const t = await getTranslations('screen');
  const name = instrument === 'GAD7' ? 'GAD-7' : 'PHQ-9';
  return { title: `${name} — JISR`, description: t('metaDescription') };
}

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return children;
}