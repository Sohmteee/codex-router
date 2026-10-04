import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PolicySchema } from "@codex-router/contracts";

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
     version INTEGER PRIMARY KEY,
     applied_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS app_state (
     key TEXT PRIMARY KEY, json_value TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS account_catalog (
     account_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, refreshed_at TEXT NOT NULL,
     status TEXT NOT NULL CHECK(status IN ('available','unavailable','stale'))
   );
   CREATE TABLE IF NOT EXISTS models (
     account_id TEXT NOT NULL, model_id TEXT NOT NULL, record_json TEXT NOT NULL,
     discovered_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY(account_id, model_id)
   );
   CREATE TABLE IF NOT EXISTS quota_snapshots (
     account_id TEXT NOT NULL, read_at TEXT NOT NULL,
     status TEXT NOT NULL CHECK(status IN ('available','unavailable','stale')),
     snapshot_json TEXT NOT NULL, PRIMARY KEY(account_id, read_at)
   );
   CREATE TABLE IF NOT EXISTS route_decisions (
     request_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, created_at TEXT NOT NULL, source TEXT NOT NULL,
     model_id TEXT NOT NULL, effort TEXT NOT NULL, reason_code TEXT NOT NULL,
     policy_revision INTEGER NOT NULL, catalog_revision INTEGER NOT NULL, decision_json TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS route_decisions_created_idx ON route_decisions(created_at);
    CREATE INDEX IF NOT EXISTS route_decisions_account_idx ON route_decisions(account_id, created_at);`,
];

export class RouterDatabase {
  readonly #db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
    this.#db.pragma("busy_timeout = 5000");
    this.#migrate();
    this.#insertDefaults();
  }

  getPolicy() {
    const row = this.#db.prepare("SELECT json_value FROM app_state WHERE key = 'policy'").get() as { json_value: string };
    return PolicySchema.parse(JSON.parse(row.json_value));
  }

  setPolicy(
    update: (current: ReturnType<RouterDatabase["getPolicy"]>) => ReturnType<RouterDatabase["getPolicy"]>,
    expectedRevision: number,
  ) {
    return this.#db.transaction(() => {
      const current = this.getPolicy();
      if (current.revision !== expectedRevision) throw new Error("revision_conflict");
      const next = PolicySchema.parse(update(current));
      if (next.revision !== current.revision + 1) throw new Error("revision_must_increment_once");
      this.#db.prepare("UPDATE app_state SET json_value = ?, revision = ?, updated_at = ? WHERE key = 'policy'")
        .run(JSON.stringify(next), next.revision, new Date().toISOString());
      return next;
    })();
  }

  close() { this.#db.close(); }

  #migrate() {
    this.#db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const applied = new Set(
      (this.#db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map((row) => row.version),
    );
    for (let index = 0; index < MIGRATIONS.length; index += 1) {
      const version = index + 1;
      if (applied.has(version)) continue;
      this.#db.transaction(() => {
        this.#db.exec(MIGRATIONS[index]!);
        this.#db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      })();
    }
  }

  #insertDefaults() {
    const defaults = {
      revision: 0, enabledModelIds: [] as string[], fallbackModelId: null as string | null,
      fallbackEffort: null as string | null, qualityPreference: 0.8,
      quotaBands: [
        { maxRemainingPercent: 50, pressure: "mild" },
        { maxRemainingPercent: 20, pressure: "strong" },
        { maxRemainingPercent: 5, pressure: "severe" },
        { maxRemainingPercent: 1, pressure: "conservation" },
      ],
      maximumLeaseMs: 300_000,
    };
    this.#db.prepare("INSERT OR IGNORE INTO app_state(key, json_value, revision, updated_at) VALUES ('policy', ?, 0, ?)")
      .run(JSON.stringify(PolicySchema.parse(defaults)), new Date().toISOString());
  }
}
