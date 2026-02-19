import { eq, and, sql, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../index';
import { cues } from '../schema';

export type Cue = InferSelectModel<typeof cues>;

export class CueRepository {
  private get db() {
    return getDb();
  }

  async create(data: {
    id: string;
    setId: string;
    position: number;
    name: string;
    config: string;
    textureUrl?: string | null;
  }) {
    const now = new Date();
    await this.db.insert(cues).values({
      id: data.id,
      setId: data.setId,
      position: data.position,
      name: data.name,
      config: data.config,
      textureUrl: data.textureUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async findById(id: string) {
    const result = await this.db.select().from(cues).where(eq(cues.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findBySetId(setId: string) {
    return this.db.select().from(cues).where(eq(cues.setId, setId)).orderBy(cues.position);
  }

  async update(
    id: string,
    data: {
      name?: string;
      config?: string;
      position?: number;
      textureUrl?: string | null;
    }
  ) {
    await this.db
      .update(cues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cues.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await this.db.delete(cues).where(eq(cues.id, id));
  }

  reorder(items: { id: string; position: number }[]) {
    this.db.transaction((tx) => {
      for (const item of items) {
        tx.update(cues)
          .set({ position: item.position, updatedAt: new Date() })
          .where(eq(cues.id, item.id))
          .run();
      }
    });
  }

  async findBySetIdAndId(setId: string, id: string) {
    const result = await this.db
      .select()
      .from(cues)
      .where(and(eq(cues.id, id), eq(cues.setId, setId)))
      .limit(1);
    return result[0] ?? null;
  }

  async countBySetId(setId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cues)
      .where(eq(cues.setId, setId));
    return result[0]?.count ?? 0;
  }

  async getMaxPosition(setId: string): Promise<number> {
    const result = await this.db
      .select({ maxPos: sql<number>`max(${cues.position})` })
      .from(cues)
      .where(eq(cues.setId, setId));
    return result[0]?.maxPos ?? 0;
  }
}

export const cueRepository = new CueRepository();
