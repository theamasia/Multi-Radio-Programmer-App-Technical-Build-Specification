/**
 * SQLite schema and migration runner.
 *
 * WHAT LIVES HERE AND WHAT DOES NOT
 *
 * Regulatory band plan data does NOT live in this database. It is static
 * TypeScript in `src/shared/frequency/data/`, because it is small, changes only
 * when federal rules change, must be reviewable in a diff with its citations,
 * and needs to be reachable from the renderer for live validation without IPC.
 *
 * This database holds the things a database is actually for:
 *
 *  1. The repeater directory cache. Thousands of rows, queried by proximity and
 *     band. Populated from RepeaterBook in Phase 5.
 *  2. The codeplug archive, including the factory snapshot that must never be
 *     overwritten.
 *
 * LICENSING BOUNDARY: repeater directory data is licensed for personal use. It
 * is cached at runtime and must never be committed to the repository or
 * redistributed. The `repeaters` table therefore lives only in the user's local
 * app-data directory, and `.gitignore` excludes `*.db`.
 */

import type { Database } from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

interface Migration {
  readonly version: number;
  readonly description: string;
  readonly sql: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Repeater directory cache and codeplug archive',
    sql: `
      -- Cached third-party repeater directory data. Personal use only.
      CREATE TABLE repeaters (
        id                INTEGER PRIMARY KEY,
        source            TEXT    NOT NULL,
        source_record_id  TEXT,
        callsign          TEXT    NOT NULL,
        output_hz         INTEGER NOT NULL,
        input_hz          INTEGER NOT NULL,
        offset_hz         INTEGER,
        mode              TEXT    NOT NULL,
        tx_tone_hz        REAL,
        rx_tone_hz        REAL,
        dcs_code          TEXT,
        dmr_color_code    INTEGER,
        location_name     TEXT,
        state_code        TEXT,
        county            TEXT,
        latitude          REAL,
        longitude         REAL,
        operational       INTEGER NOT NULL DEFAULT 1,
        notes             TEXT,
        fetched_at        TEXT    NOT NULL,
        UNIQUE (source, source_record_id)
      );

      -- Proximity and band queries are the two access patterns that matter.
      CREATE INDEX idx_repeaters_location  ON repeaters (latitude, longitude);
      CREATE INDEX idx_repeaters_output    ON repeaters (output_hz);
      CREATE INDEX idx_repeaters_state     ON repeaters (state_code);

      -- Archived codeplug images, including the irreplaceable factory snapshot.
      CREATE TABLE codeplug_archive (
        id             INTEGER PRIMARY KEY,
        model_id       TEXT    NOT NULL,
        radio_serial   TEXT,
        firmware       TEXT,
        label          TEXT    NOT NULL,
        -- 'factory' snapshots are write-once; see the trigger below.
        kind           TEXT    NOT NULL CHECK (kind IN ('factory', 'backup', 'edit')),
        raw_image      BLOB    NOT NULL,
        image_sha256   TEXT    NOT NULL,
        byte_length    INTEGER NOT NULL,
        address_map    TEXT,
        created_at     TEXT    NOT NULL
      );

      CREATE INDEX idx_archive_model ON codeplug_archive (model_id, created_at);

      -- Rule 4 of the engineering rules, enforced by the database rather than by
      -- convention: the factory codeplug is snapshotted once and never altered.
      CREATE TRIGGER factory_snapshot_is_immutable
      BEFORE UPDATE ON codeplug_archive
      WHEN OLD.kind = 'factory'
      BEGIN
        SELECT RAISE(ABORT, 'factory codeplug snapshots are immutable');
      END;

      CREATE TRIGGER factory_snapshot_no_delete
      BEFORE DELETE ON codeplug_archive
      WHEN OLD.kind = 'factory'
      BEGIN
        SELECT RAISE(ABORT, 'factory codeplug snapshots cannot be deleted');
      END;

      -- At most one factory snapshot per physical radio.
      CREATE UNIQUE INDEX idx_one_factory_per_radio
        ON codeplug_archive (model_id, COALESCE(radio_serial, ''))
        WHERE kind = 'factory';
    `,
  },
];

/**
 * Applies any migrations the database has not yet seen.
 *
 * Uses SQLite's own `user_version` pragma rather than a bookkeeping table, so
 * the version travels with the file and cannot drift from it.
 */
export function migrate(db: Database): number {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const current = Number((db.pragma('user_version', { simple: true }) as number) ?? 0);
  const pending = MIGRATIONS.filter((migration) => migration.version > current);

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return Number((db.pragma('user_version', { simple: true }) as number) ?? 0);
}
