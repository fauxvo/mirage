import { eq, isNull, and, type InferSelectModel } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../index';
import { apiKeys } from '../schema';

export type ApiKeyRow = InferSelectModel<typeof apiKeys>;

export class ApiKeyRepository {
  private get db() {
    return getDb();
  }

  async create(data: { name: string; keyHash: string; keyPrefix: string; createdById: string }) {
    const id = nanoid(16);
    const now = new Date();
    const result = await this.db
      .insert(apiKeys)
      .values({
        id,
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        createdById: data.createdById,
        createdAt: now,
      })
      .returning();
    return result[0];
  }

  async findByHash(keyHash: string): Promise<ApiKeyRow | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    return result[0] ?? null;
  }

  async findById(id: string): Promise<ApiKeyRow | null> {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByIdAndUser(id: string, userId: string): Promise<ApiKeyRow | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.createdById, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  async listAll() {
    return this.db.select().from(apiKeys).orderBy(apiKeys.createdAt);
  }

  async listByUser(userId: string) {
    return this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.createdById, userId))
      .orderBy(apiKeys.createdAt);
  }

  async listActive() {
    return this.db
      .select()
      .from(apiKeys)
      .where(isNull(apiKeys.revokedAt))
      .orderBy(apiKeys.createdAt);
  }

  async revoke(id: string) {
    await this.db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async updateLastUsedAt(id: string) {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async hasActiveKeys() {
    const result = await this.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(isNull(apiKeys.revokedAt))
      .limit(1);
    return result.length > 0;
  }
}

export const apiKeyRepository = new ApiKeyRepository();
