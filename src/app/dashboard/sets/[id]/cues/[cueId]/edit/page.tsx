import { redirect } from 'next/navigation';

export default async function EditCuePage({
  params,
}: {
  params: Promise<{ id: string; cueId: string }>;
}) {
  const { id, cueId } = await params;
  redirect(`/v/${id}?cue=${cueId}`);
}
