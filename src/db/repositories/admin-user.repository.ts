import { eq } from 'drizzle-orm';
import { count as drizzleCount } from 'drizzle-orm';
import { getDb } from '../index';
import { adminUsers } from '../schema';

export class AdminUserRepository {
  private get db() {
    return getDb();
  }

  async create(data: { username: string; passwordHash: string }) {
    const now = new Date();
    await this.db.insert(adminUsers).values({
      username: data.username,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    return this.findByUsername(data.username);
  }

  async findById(id: number) {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByUsername(username: string) {
    const result = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);
    return result[0] ?? null;
  }

  async listAll() {
    return this.db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      })
      .from(adminUsers)
      .orderBy(adminUsers.id);
  }

  async delete(id: number) {
    await this.db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async updatePassword(id: number, passwordHash: string) {
    await this.db
      .update(adminUsers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(adminUsers.id, id));
  }

  async count() {
    const result = await this.db.select({ value: drizzleCount() }).from(adminUsers);
    return result[0]?.value ?? 0;
  }
}

export const adminUserRepository = new AdminUserRepository();
