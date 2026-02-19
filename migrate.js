// migrate.js — Apply Drizzle SQL migrations to SQLite at container startup
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || './data/mirage.db';
const MIGRATIONS_DIR = path.join(__dirname, 'drizzle');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )
`);

// Read journal
const journalPath = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');
if (!fs.existsSync(journalPath)) {
  console.log('[mirage] No migration journal found, skipping migrations');
  db.close();
  process.exit(0);
}

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

// Get applied migrations
const applied = new Set(
  db
    .prepare('SELECT hash FROM __drizzle_migrations')
    .all()
    .map((r) => r.hash)
);

// Apply pending migrations
let count = 0;
for (const entry of journal.entries) {
  if (applied.has(entry.tag)) continue;

  const sqlFile = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
  if (!fs.existsSync(sqlFile)) {
    console.error(`[mirage] Migration file not found: ${entry.tag}.sql`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf-8');

  // Split on drizzle statement breakpoints and execute each statement
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  const transaction = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt);
    }
    db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
      entry.tag,
      Date.now()
    );
  });

  transaction();
  console.log(`[mirage] Applied migration: ${entry.tag}`);
  count++;
}

db.close();

if (count > 0) {
  console.log(`[mirage] ${count} migration(s) applied`);
} else {
  console.log('[mirage] Database is up to date');
}
