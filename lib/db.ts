import "server-only";
import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as { _dbPromise?: Promise<Client> };

export function getDb(): Promise<Client> {
  globalForDb._dbPromise ??= (async () => {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");

    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken && url.startsWith("libsql://")) {
      throw new Error("TURSO_AUTH_TOKEN is required for remote Turso databases");
    }

    const client = createClient({ url, authToken });

    await client.batch(
      [
        `CREATE TABLE IF NOT EXISTS snapshots (
           id           INTEGER PRIMARY KEY AUTOINCREMENT,
           store        TEXT    NOT NULL,
           app_id       TEXT    NOT NULL,
           saved_at     TEXT    NOT NULL,
           score        REAL    NOT NULL,
           review_count INTEGER NOT NULL,
           min_installs INTEGER
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup
           ON snapshots (store, app_id, saved_at)`,
      ],
      "write"
    );

    // ALTER TABLE has no IF NOT EXISTS guard in SQLite.
    // Run each migration individually outside the batch so a failure does not
    // poison _dbPromise — "duplicate column name" just means the column exists.
    const columnMigrations = ["ALTER TABLE snapshots ADD COLUMN version TEXT"];
    for (const sql of columnMigrations) {
      try {
        await client.execute(sql);
      } catch (err) {
        // Only swallow "duplicate column name" — the column already exists.
        // Re-throw anything else (connection errors, syntax errors, etc.).
        if (!(err instanceof Error && err.message.includes("duplicate column name"))) {
          throw err;
        }
      }
    }

    return client;
  })();

  return globalForDb._dbPromise;
}
