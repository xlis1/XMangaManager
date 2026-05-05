import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const manga = sqliteTable(
  "manga",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    sourceMangaId: text("source_manga_id").notNull(),

    title: text("title").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),

    displayTitle: text("display_title"),
    localCoverPath: text("local_cover_path"),
    localCoverUrl: text("local_cover_url"),

    readerDirection: text("reader_direction"),
    readerClickMode: text("reader_click_mode"),
    readerPageFit: text("reader_page_fit"),
    readerCustomWidth: integer("reader_custom_width"),
    readerCustomHeight: integer("reader_custom_height"),
    readerPagePadding: integer("reader_page_padding"),

    tracked: integer("tracked", { mode: "boolean" }).notNull().default(true),
    autoDownload: integer("auto_download", { mode: "boolean" })
      .notNull()
      .default(false),
    lastCheckedAt: text("last_checked_at"),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    sourceUnique: uniqueIndex("manga_source_unique").on(
      table.sourceId,
      table.sourceMangaId,
    ),
  }),
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    mangaId: text("manga_id").notNull(),

    sourceChapterId: text("source_chapter_id").notNull(),

    title: text("title"),
    chapterNumber: text("chapter_number"),
    language: text("language"),
    publishedAt: text("published_at"),

    downloadStatus: text("download_status").notNull().default("not_downloaded"),
    readStatus: text("read_status").notNull().default("unread"),
    lastReadPageIndex: integer("last_read_page_index").notNull().default(0),
    lastReadAt: text("last_read_at"),
    downloadedAt: text("downloaded_at"),
    isInitialImport: integer("is_initial_import", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    sourceChapterUnique: uniqueIndex("chapter_source_unique").on(
      table.sourceChapterId,
    ),
  }),
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id").notNull(),

    pageIndex: integer("page_index").notNull(),
    remoteUrl: text("remote_url").notNull(),
    localPath: text("local_path"),
    localUrl: text("local_url"),

    downloadStatus: text("download_status").notNull().default("not_downloaded"),
    downloadError: text("download_error"),
    downloadedAt: text("downloaded_at"),

    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    chapterPageUnique: uniqueIndex("page_chapter_index_unique").on(
      table.chapterId,
      table.pageIndex,
    ),
  }),
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});