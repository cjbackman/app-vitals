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
  }
  return globalForDb._db;
}
