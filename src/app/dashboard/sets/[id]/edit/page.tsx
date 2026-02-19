import { SetForm } from '@/components/dashboard/set-form';

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SetForm mode="edit" setId={id} />;
}
