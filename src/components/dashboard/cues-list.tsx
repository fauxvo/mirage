'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { GripVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { getSceneCategory } from '@/constants/scene-categories';
import type { CueResponse } from '@/types/api';

interface CuesListProps {
  setId: string;
  cues: CueResponse[];
  onCuesChange: (cues: CueResponse[]) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  organic: 'bg-emerald-500/15 text-emerald-400/80 border-emerald-500/20',
  cosmic: 'bg-purple-500/15 text-purple-400/80 border-purple-500/20',
  geometric: 'bg-blue-500/15 text-blue-400/80 border-blue-500/20',
  abstract: 'bg-amber-500/15 text-amber-400/80 border-amber-500/20',
  immersive: 'bg-pink-500/15 text-pink-400/80 border-pink-500/20',
};

function getSceneBadgeClass(scene: string): string {
  const cat = getSceneCategory(scene);
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.abstract;
}

function SortableCueRow({
  cue,
  setId,
  onDeleteClick,
}: {
  cue: CueResponse;
  setId: string;
  onDeleteClick: (cue: CueResponse) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const scene = (cue.config?.scene as string) || 'unknown';
  const badgeClass = getSceneBadgeClass(scene);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04] last:border-0 group transition-colors ${
        isDragging ? 'opacity-50 bg-white/[0.02]' : 'hover:bg-white/[0.02]'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-0.5 rounded text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors touch-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Position */}
      <span className="shrink-0 w-5 text-center text-[10px] font-mono text-white/20">
        {cue.position}
      </span>

      {/* Name + scene */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-white/70 truncate">{cue.name}</span>
        <span
          className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}
        >
          {scene}
        </span>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/dashboard/sets/${setId}/cues/${cue.id}/edit`}
          className="p-1.5 rounded text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
          title="Edit cue"
        >
          <Pencil className="w-3 h-3" />
        </Link>
        <button
          onClick={() => onDeleteClick(cue)}
          className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Delete cue"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function CueRowOverlay({ cue }: { cue: CueResponse }) {
  const scene = (cue.config?.scene as string) || 'unknown';
  const badgeClass = getSceneBadgeClass(scene);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-neutral-900 border border-white/[0.12] rounded-lg shadow-xl">
      <GripVertical className="w-3.5 h-3.5 text-white/30 shrink-0" />
      <span className="shrink-0 w-5 text-center text-[10px] font-mono text-white/20">
        {cue.position}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-white/70 truncate">{cue.name}</span>
        <span
          className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}
        >
          {scene}
        </span>
      </div>
    </div>
  );
}

export function CuesList({ setId, cues, onCuesChange }: CuesListProps) {
  const [deleteTarget, setDeleteTarget] = useState<CueResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedCues = [...cues].sort((a, b) => a.position - b.position);
  const activeCue = activeDragId ? sortedCues.find((c) => c.id === activeDragId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = sortedCues.findIndex((c) => c.id === active.id);
    const newIndex = sortedCues.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(sortedCues, oldIndex, newIndex);

    // Optimistic update: reassign positions starting from 1
    const withPositions = reordered.map((cue, i) => ({ ...cue, position: i + 1 }));
    onCuesChange(withPositions);

    // Persist to API
    setReordering(true);
    try {
      const res = await fetch(`/api/sets/${setId}/cues/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withPositions.map((c) => ({ id: c.id, position: c.position }))),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on failure
        onCuesChange(cues);
      }
    } catch {
      onCuesChange(cues);
    } finally {
      setReordering(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch(`/api/sets/${setId}/cues/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setDeleteError(data.error || 'Failed to delete cue');
        return;
      }
      onCuesChange(cues.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {reordering && (
        <div className="px-3 py-1.5 text-[10px] text-white/20 bg-white/[0.02] border-b border-white/[0.04]">
          Saving order...
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedCues.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {sortedCues.map((cue) => (
            <SortableCueRow key={cue.id} cue={cue} setId={setId} onDeleteClick={setDeleteTarget} />
          ))}
        </SortableContext>
        <DragOverlay>{activeCue ? <CueRowOverlay cue={activeCue} /> : null}</DragOverlay>
      </DndContext>

      {/* Add cue link */}
      <div className="px-3 py-2.5 border-t border-white/[0.04]">
        <Link
          href={`/dashboard/sets/${setId}/cues/new`}
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Cue
        </Link>
      </div>

      {/* Delete error inline */}
      {deleteError && (
        <div className="mx-3 mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {deleteError}
          <button
            onClick={() => setDeleteError('')}
            className="ml-2 text-red-400/60 hover:text-red-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Cue"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleteLoading}
      />
    </div>
  );
}
