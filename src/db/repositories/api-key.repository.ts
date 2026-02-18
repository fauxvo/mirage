import { eq, isNull, isNotNull } from 'drizzle-orm';
import { getDb } from '../index';
import { apiKeys } from '../schema';

export class ApiKeyRepository {
  private get db() {
    return getDb();
  }

  async create(data: { name: string; keyHash: string; keyPrefix: string; createdById: number }) {
    const now = new Date();
    const result = await this.db
      .insert(apiKeys)
      .values({
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        createdById: data.createdById,
        createdAt: now,
      })
      .returning();
    return result[0];
  }

  async findByHash(keyHash: string) {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    return result[0] ?? null;
  }

  async findById(id: number) {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    return result[0] ?? null;
  }

  async listAll() {
    return this.db.select().from(apiKeys).orderBy(apiKeys.id);
  }

  async listActive() {
    return this.db.select().from(apiKeys).where(isNull(apiKeys.revokedAt)).orderBy(apiKeys.id);
  }

  async revoke(id: number) {
    await this.db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
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
