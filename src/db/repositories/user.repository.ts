import { eq, type InferSelectModel } from 'drizzle-orm';
import { count as drizzleCount } from 'drizzle-orm';
import { getDb } from '../index';
import { users } from '../schema';

export type UserRow = InferSelectModel<typeof users>;

export class UserRepository {
  private get db() {
    return getDb();
  }

  async create(data: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    role?: 'admin' | 'user';
  }) {
    const now = new Date();
    await this.db.insert(users).values({
      id: data.id,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? 'user',
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(data.id);
  }

  async findById(id: string): Promise<UserRow | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ?? null;
  }

  async listAll() {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.createdAt);
  }

  async delete(id: string) {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async countAdmins() {
    const result = await this.db
      .select({ value: drizzleCount() })
      .from(users)
      .where(eq(users.role, 'admin'));
    return result[0]?.value ?? 0;
  }

  async count() {
    const result = await this.db.select({ value: drizzleCount() }).from(users);
    return result[0]?.value ?? 0;
  }
}

export const userRepository = new UserRepository();
