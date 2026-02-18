import { eq, sql, gte, and, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../index';
import { apiUsage, apiKeys } from '../schema';

export type ApiUsageRow = InferSelectModel<typeof apiUsage>;

export class ApiUsageRepository {
  private get db() {
    return getDb();
  }

  async create(data: {
    apiKeyId: string;
    method: string;
    path: string;
    statusCode: number;
    responseTimeMs?: number;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.db.insert(apiUsage).values({
      apiKeyId: data.apiKeyId,
      method: data.method,
      path: data.path,
      statusCode: data.statusCode,
      responseTimeMs: data.responseTimeMs ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      timestamp: new Date(),
    });
  }

  async getUsageByKey(apiKeyId: string, since?: Date) {
    const whereClause = since
      ? and(eq(apiUsage.apiKeyId, apiKeyId), gte(apiUsage.timestamp, since))
      : eq(apiUsage.apiKeyId, apiKeyId);

    return this.db
      .select()
      .from(apiUsage)
      .where(whereClause)
      .orderBy(sql`${apiUsage.timestamp} DESC`)
      .limit(100);
  }

  async getOverviewStats(since?: Date) {
    const sinceCondition = since ? gte(apiUsage.timestamp, since) : undefined;

    const totalRequests = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(apiUsage)
      .where(sinceCondition);

    const perKeyStats = await this.db
      .select({
        apiKeyId: apiUsage.apiKeyId,
        keyName: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        requestCount: sql<number>`count(*)`,
        avgResponseTime: sql<number>`avg(${apiUsage.responseTimeMs})`,
        lastRequest: sql<string>`max(${apiUsage.timestamp})`,
      })
      .from(apiUsage)
      .leftJoin(apiKeys, eq(apiUsage.apiKeyId, apiKeys.id))
      .where(sinceCondition)
      .groupBy(apiUsage.apiKeyId, apiKeys.name, apiKeys.keyPrefix);

    const methodBreakdown = await this.db
      .select({
        method: apiUsage.method,
        count: sql<number>`count(*)`,
      })
      .from(apiUsage)
      .where(sinceCondition)
      .groupBy(apiUsage.method);

    return {
      totalRequests: totalRequests[0]?.count ?? 0,
      perKeyStats,
      methodBreakdown,
    };
  }
}

export const apiUsageRepository = new ApiUsageRepository();
