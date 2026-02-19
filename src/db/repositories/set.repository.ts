import { eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../index';
import { sets, cues } from '../schema';
import type { Cue } from './cue.repository';

export type Set = InferSelectModel<typeof sets>;

export interface SetWithCues extends Set {
  cues: Cue[];
}

export class SetRepository {
  private get db() {
    return getDb();
  }

  async create(data: {
    id: string;
    userId: string;
    name: string;
    description?: string | null;
    youtubePlaylistUrl?: string | null;
    isPublic?: boolean;
  }) {
    const now = new Date();
    await this.db.insert(sets).values({
      id: data.id,
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      youtubePlaylistUrl: data.youtubePlaylistUrl ?? null,
      isPublic: data.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async findById(id: string) {
    const result = await this.db.select().from(sets).where(eq(sets.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByIdWithCues(id: string): Promise<SetWithCues | null> {
    const set = await this.findById(id);
    if (!set) return null;

    const setCues = await this.db
      .select()
      .from(cues)
      .where(eq(cues.setId, id))
      .orderBy(cues.position);

    return { ...set, cues: setCues };
  }

  async listByUser(userId: string) {
    return this.db.select().from(sets).where(eq(sets.userId, userId)).orderBy(sets.createdAt);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      youtubePlaylistUrl?: string | null;
      isPublic?: boolean;
    }
  ) {
    await this.db
      .update(sets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sets.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await this.db.delete(sets).where(eq(sets.id, id));
  }
}

export const setRepository = new SetRepository();
