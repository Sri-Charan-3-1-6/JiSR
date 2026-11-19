import ScreenClient from './screen-client';

export const instant = false;

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ instrument: string }>;
}) {
  const { instrument } = await params;
  return <ScreenClient instrument={instrument} />;
}