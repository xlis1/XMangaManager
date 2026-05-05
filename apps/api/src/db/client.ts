import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import * as schema from "./schema.js";

mkdirSync("data/media", { recursive: true });

const sqlite = new Database("data/manga.db");

export const db = drizzle(sqlite, { schema });

function addColumnIfMissing(table: string, column: string, sql: string) {
  const existing = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];

  if (!existing.some((col) => col.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`);
  }
}

export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS manga (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_manga_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      cover_url TEXT,
      tracked INTEGER NOT NULL DEFAULT 1,
      auto_download INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      display_title TEXT,
      local_cover_path TEXT,
      local_cover_url TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS manga_source_unique
      ON manga(source_id, source_manga_id);

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      manga_id TEXT NOT NULL,
      source_chapter_id TEXT NOT NULL,
      title TEXT,
      chapter_number TEXT,
      language TEXT,
      published_at TEXT,
      download_status TEXT NOT NULL DEFAULT 'not_downloaded',
      read_status TEXT NOT NULL DEFAULT 'unread',
      last_read_page_index INTEGER NOT NULL DEFAULT 0,
      last_read_at TEXT,
      downloaded_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS chapter_source_unique
      ON chapters(source_chapter_id);

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      page_index INTEGER NOT NULL,
      remote_url TEXT NOT NULL,
      local_path TEXT,
      local_url TEXT,
      download_status TEXT NOT NULL DEFAULT 'not_downloaded',
      download_error TEXT,
      downloaded_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS page_chapter_index_unique
      ON pages(chapter_id, page_index);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);


  addColumnIfMissing("manga", "reader_direction", "reader_direction TEXT");
  addColumnIfMissing("manga", "reader_click_mode", "reader_click_mode TEXT");
  addColumnIfMissing("manga", "reader_page_fit", "reader_page_fit TEXT");
  addColumnIfMissing("manga", "reader_custom_width", "reader_custom_width INTEGER");
  addColumnIfMissing("manga", "reader_custom_height", "reader_custom_height INTEGER");
  addColumnIfMissing("manga", "reader_page_padding", "reader_page_padding INTEGER");

  addColumnIfMissing("manga", "tracked", "tracked INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(
    "manga",
    "auto_download",
    "auto_download INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing("manga", "last_checked_at", "last_checked_at TEXT");

  addColumnIfMissing(
    "chapters",
    "download_status",
    "download_status TEXT NOT NULL DEFAULT 'not_downloaded'",
  );
  addColumnIfMissing(
    "chapters",
    "read_status",
    "read_status TEXT NOT NULL DEFAULT 'unread'",
  );
  addColumnIfMissing(
    "chapters",
    "last_read_page_index",
    "last_read_page_index INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing("chapters", "last_read_at", "last_read_at TEXT");
  addColumnIfMissing("chapters", "downloaded_at", "downloaded_at TEXT");

  addColumnIfMissing("pages", "local_url", "local_url TEXT");
  addColumnIfMissing(
    "pages",
    "download_status",
    "download_status TEXT NOT NULL DEFAULT 'not_downloaded'",
  );
  addColumnIfMissing("pages", "download_error", "download_error TEXT");
  addColumnIfMissing("pages", "downloaded_at", "downloaded_at TEXT");
  addColumnIfMissing(
    "chapters",
    "is_initial_import",
    "is_initial_import INTEGER NOT NULL DEFAULT 0",

  );
  addColumnIfMissing("manga", "display_title", "display_title TEXT");
  addColumnIfMissing("manga", "local_cover_path", "local_cover_path TEXT");
  addColumnIfMissing("manga", "local_cover_url", "local_cover_url TEXT");
}