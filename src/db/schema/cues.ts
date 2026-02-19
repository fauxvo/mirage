import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sets } from './sets';

export const cues = sqliteTable(
  'cues',
  {
    id: text('id').primaryKey(), // nanoid 12
    setId: text('set_id')
      .notNull()
      .references(() => sets.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    config: text('config').notNull(), // JSON text
    textureUrl: text('texture_url'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('cues_set_id_position_idx').on(table.setId, table.position)]
);
