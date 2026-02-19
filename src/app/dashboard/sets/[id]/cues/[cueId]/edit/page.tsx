import { SCENE_METADATA, SCENE_CATEGORIES } from '@/constants/scene-metadata';
import { COLOR_PRESETS } from '@/constants/visualizer-presets';
import { CueForm } from '@/components/dashboard/cue-form';

export default async function EditCuePage({
  params,
}: {
  params: Promise<{ id: string; cueId: string }>;
}) {
  const { id, cueId } = await params;

  const scenes = SCENE_METADATA.map((s) => ({ id: s.id, name: s.name, category: s.category }));
  const presets = COLOR_PRESETS.map((p) => ({ id: p.id, name: p.name, colors: p.colors }));

  return (
    <CueForm
      mode="edit"
      setId={id}
      cueId={cueId}
      scenes={scenes}
      categories={[...SCENE_CATEGORIES]}
      colorPresets={presets}
    />
  );
}
