import "server-only";
import Database from "better-sqlite3";

const globalForDb = global as typeof global & { _db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb._db) {
    globalForDb._db = new Database("./data/snapshots.db");
    globalForDb._db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        store        TEXT    NOT NULL,
        app_id       TEXT    NOT NULL,
        saved_at     TEXT    NOT NULL,
        score        REAL    NOT NULL,
        review_count INTEGER NOT NULL,
        min_installs INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
        ON snapshots (store, app_id, saved_at);
    `);
    try {
      globalForDb._db.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup ON snapshots (store, app_id, saved_at)"
      );
    } catch {
      // Dev DB has duplicate (store, app_id, saved_at) rows — index not created.
      // INSERT OR IGNORE in the bulk import route will still prevent new duplicates
      // once the index exists. Clean up existing duplicates with:
      // DELETE FROM snapshots WHERE id NOT IN (SELECT MIN(id) FROM snapshots GROUP BY store, app_id, saved_at)
    }
  }
  return globalForDb._db;
}
