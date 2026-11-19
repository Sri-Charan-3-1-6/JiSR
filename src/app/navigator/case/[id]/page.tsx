import CaseClient from './case-client';

export const instant = false;

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseClient id={id} />;
}