import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { sessions } from '../schema';

export class SessionRepository {
  private get db() {
    return getDb();
  }

  async create(data: { id: string; adminToken: string; config: string; textureUrl?: string | null }) {
    const now = new Date();
    await this.db.insert(sessions).values({
      id: data.id,
      adminToken: data.adminToken,
      config: data.config,
      textureUrl: data.textureUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async findById(id: string) {
    const result = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0] ?? null;
  }

  async update(id: string, data: { config?: string; textureUrl?: string | null }) {
    await this.db
      .update(sessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessions.id, id));
    return this.findById(id);
  }

  async delete(id: string) {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async listByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const results = await this.db.select().from(sessions);
    return results.filter((s) => ids.includes(s.id));
  }
}

export const sessionRepository = new SessionRepository();
