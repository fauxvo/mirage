'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CueManagementPanel } from '@/components/visualizer/cue-management-panel';
import type { CueSummary } from '@/components/visualizer/cue-switcher-bar';
import type { VisualizerConfig } from '@/types/visualizer';
import type { CueResponse } from '@/types/api';
import { buildDefaultConfig } from '@/constants/visualizer-presets';

interface CuesListProps {
  setId: string;
  cues: CueResponse[];
  onCuesChange: (cues: CueResponse[]) => void;
}

/**
 * Dashboard wrapper around the shared CueManagementPanel.
 * Adapts CueResponse[] to the CueSummary[] + configs Map format
 * and navigates to the visualizer on cue click.
 */
export function CuesList({ setId, cues, onCuesChange }: CuesListProps) {
  const router = useRouter();

  // Adapt CueResponse[] → CueSummary[]
  const cueSummaries: CueSummary[] = cues.map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
  }));

  // Adapt CueResponse[] → configs Map
  const cueConfigs = new Map(
    cues.map((c) => [
      c.id,
      {
        config: c.config,
        textureUrl: c.textureUrl,
      },
    ])
  );

  const handleSwitchCue = useCallback(
    (cueId: string) => {
      router.push(`/v/${setId}?cue=${cueId}`);
    },
    [router, setId]
  );

  const handleCuesChange = useCallback(
    (updated: CueSummary[]) => {
      // Merge updated positions back into CueResponse objects
      const updatedCues = updated.map((summary) => {
        const original = cues.find((c) => c.id === summary.id);
        return original
          ? { ...original, name: summary.name, position: summary.position }
          : ({
              ...summary,
              config: buildDefaultConfig('particles'),
              textureUrl: null,
              createdAt: '',
              updatedAt: '',
            } as CueResponse);
      });
      onCuesChange(updatedCues);
    },
    [cues, onCuesChange]
  );

  const handleCueAdded = useCallback(
    (cue: CueSummary, config: VisualizerConfig) => {
      const newCueResponse: CueResponse = {
        id: cue.id,
        name: cue.name,
        position: cue.position,
        config,
        textureUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onCuesChange([...cues, newCueResponse]);
      router.push(`/v/${setId}?cue=${cue.id}`);
    },
    [cues, onCuesChange, router, setId]
  );

  const handleCueDeleted = useCallback(
    (cueId: string) => {
      onCuesChange(cues.filter((c) => c.id !== cueId));
    },
    [cues, onCuesChange]
  );

  const handleCueRenamed = useCallback(
    (cueId: string, name: string) => {
      onCuesChange(cues.map((c) => (c.id === cueId ? { ...c, name } : c)));
    },
    [cues, onCuesChange]
  );

  return (
    <CueManagementPanel
      setId={setId}
      cues={cueSummaries}
      cueConfigs={cueConfigs}
      onSwitchCue={handleSwitchCue}
      onCuesChange={handleCuesChange}
      onCueAdded={handleCueAdded}
      onCueDeleted={handleCueDeleted}
      onCueRenamed={handleCueRenamed}
    />
  );
}
