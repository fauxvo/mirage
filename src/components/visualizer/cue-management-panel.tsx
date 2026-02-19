'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSceneCategory, CATEGORY_COLORS } from '@/constants/scene-categories';
import { buildDefaultConfig } from '@/constants/visualizer-presets';
import type { CueSummary } from '@/components/visualizer/cue-switcher-bar';
import type { VisualizerConfig, VisualizerColorPalette } from '@/types/visualizer';

interface CueManagementPanelProps {
  setId: string;
  cues: CueSummary[];
  activeCueId?: string;
  cueConfigs: Map<string, { config: VisualizerConfig; textureUrl: string | null }>;
  onSwitchCue: (cueId: string) => void;
  onCuesChange: (cues: CueSummary[]) => void;
  onCueAdded: (cue: CueSummary, config: VisualizerConfig) => void;
  onCueDeleted: (cueId: string) => void;
  onCueRenamed: (cueId: string, name: string) => void;
}

function getSceneBadgeClass(scene: string): string {
  const cat = getSceneCategory(scene);
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.abstract;
}

function PaletteDots({ palette }: { palette: VisualizerColorPalette }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {Object.values(palette).map((color, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full border border-white/10"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function SortableCueRow({
  cue,
  isActive,
  config,
  onSwitchCue,
  onDeleteClick,
  onRename,
  canDelete,
}: {
  cue: CueSummary;
  isActive: boolean;
  config?: { config: VisualizerConfig; textureUrl: string | null };
  onSwitchCue: (id: string) => void;
  onDeleteClick: (cue: CueSummary) => void;
  onRename: (id: string, name: string) => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cue.id,
  });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cue.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const scene = config?.config.scene || 'unknown';
  const badgeClass = getSceneBadgeClass(scene);

  const handleCommitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== cue.name) {
      onRename(cue.id, trimmed);
    } else {
      setEditName(cue.name);
    }
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => !editing && onSwitchCue(cue.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditName(cue.name);
        setEditing(true);
      }}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer group transition-colors',
        isDragging && 'opacity-50',
        isActive ? 'bg-white/10' : 'hover:bg-white/5'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 p-0.5 rounded text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {/* Position number */}
      <span className="shrink-0 w-4 text-center text-[10px] font-mono text-white/25">
        {cue.position}
      </span>

      {/* Palette dots */}
      {config && <PaletteDots palette={config.config.colorPalette} />}

      {/* Name (editable on double-click) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitRename();
              if (e.key === 'Escape') {
                setEditName(cue.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white/80 focus:outline-none focus:border-white/40"
          />
        ) : (
          <span className="text-xs text-white/70 truncate block">{cue.name}</span>
        )}
      </div>

      {/* Scene badge */}
      <span
        className={cn('shrink-0 text-[8px] font-medium px-1.5 py-0.5 rounded border', badgeClass)}
      >
        {scene}
      </span>

      {/* Delete */}
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(cue);
          }}
          className="shrink-0 p-1 rounded text-white/0 group-hover:text-white/20 hover:!text-red-400 hover:bg-red-400/10 transition-all"
          title="Delete cue"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function CueRowOverlay({
  cue,
  config,
}: {
  cue: CueSummary;
  config?: { config: VisualizerConfig; textureUrl: string | null };
}) {
  const scene = config?.config.scene || 'unknown';
  const badgeClass = getSceneBadgeClass(scene);

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 bg-neutral-900 border border-white/15 rounded-lg shadow-xl">
      <GripVertical className="w-3 h-3 text-white/30 shrink-0" />
      <span className="shrink-0 w-4 text-center text-[10px] font-mono text-white/25">
        {cue.position}
      </span>
      {config && <PaletteDots palette={config.config.colorPalette} />}
      <span className="text-xs text-white/70 truncate flex-1">{cue.name}</span>
      <span
        className={cn('shrink-0 text-[8px] font-medium px-1.5 py-0.5 rounded border', badgeClass)}
      >
        {scene}
      </span>
    </div>
  );
}

export function CueManagementPanel({
  setId,
  cues,
  activeCueId,
  cueConfigs,
  onSwitchCue,
  onCuesChange,
  onCueAdded,
  onCueDeleted,
  onCueRenamed,
}: CueManagementPanelProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CueSummary | null>(null);
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sorted = [...cues].sort((a, b) => a.position - b.position);
  const activeDragCue = activeDragId ? sorted.find((c) => c.id === activeDragId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((c) => c.id === active.id);
    const newIndex = sorted.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    const withPositions = reordered.map((cue, i) => ({ ...cue, position: i + 1 }));
    onCuesChange(withPositions);

    setReordering(true);
    try {
      const res = await fetch(`/api/sets/${setId}/cues/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withPositions.map((c) => ({ id: c.id, position: c.position }))),
      });
      const data = await res.json();
      if (!data.success) onCuesChange(cues);
    } catch {
      onCuesChange(cues);
    } finally {
      setReordering(false);
    }
  }

  async function handleAddCue() {
    setCreating(true);
    setError('');
    try {
      const name = `Cue ${cues.length + 1}`;
      const config = buildDefaultConfig('particles');
      const res = await fetch(`/api/sets/${setId}/cues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        const newCue: CueSummary = {
          id: data.data.id,
          name: data.data.name,
          position: data.data.position,
        };
        onCueAdded(newCue, config);
      } else {
        setError(data.error || 'Failed to create cue');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setError('');
    try {
      const res = await fetch(`/api/sets/${setId}/cues/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to delete cue');
      } else {
        onCueDeleted(deleteConfirm.id);
      }
    } catch {
      setError('Network error');
    }
    setDeleteConfirm(null);
  }

  async function handleRename(cueId: string, name: string) {
    try {
      const res = await fetch(`/api/sets/${setId}/cues/${cueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        onCueRenamed(cueId, name);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      {reordering && <div className="text-[10px] text-white/20">Saving order...</div>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((cue) => (
            <SortableCueRow
              key={cue.id}
              cue={cue}
              isActive={cue.id === activeCueId}
              config={cueConfigs.get(cue.id)}
              onSwitchCue={onSwitchCue}
              onDeleteClick={setDeleteConfirm}
              onRename={handleRename}
              canDelete={cues.length > 1}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeDragCue ? (
            <CueRowOverlay cue={activeDragCue} config={cueConfigs.get(activeDragCue.id)} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
          <p className="text-xs text-white/60">Delete &ldquo;{deleteConfirm.name}&rdquo;?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add cue button */}
      <button
        disabled={creating}
        onClick={handleAddCue}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white/60 text-xs font-medium transition-colors disabled:opacity-50"
      >
        {creating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        Add Cue
      </button>

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 text-red-400/60 hover:text-red-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <p className="text-white/20 text-[10px]">
        Click to switch. Double-click name to rename. Drag to reorder.
      </p>
    </div>
  );
}
