import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { apiKeys } from './api-keys';

export const apiUsage = sqliteTable(
  'api_usage',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    apiKeyId: text('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    responseTimeMs: integer('response_time_ms'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    timestamp: integer('timestamp', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('api_usage_key_timestamp_idx').on(table.apiKeyId, table.timestamp)]
);
