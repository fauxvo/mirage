import { redirect } from 'next/navigation';

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/v/${id}`);
}
