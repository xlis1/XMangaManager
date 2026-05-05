import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import { chapters, manga } from "../db/schema.js";
import { getSource } from "../sources/index.js";
import { pages } from "../db/schema.js";
import { getConfig } from "../config/config.service.js";
import { runRateLimited } from "../utils/rate-limit.js";
import { logger } from "../utils/logger.js";
import {
  deleteMangaMedia,
  downloadFileToPath,
  getCoverFilePath,
  getCoverLocalUrl,
  isUsableDownloadedFile,
} from "../storage/media-storage.service.js";
import {
  downloadChapter,
  markChapterRead,
  markChapterUnread,
  repairChapter,
  verifyChapter,
} from "../chapters/chapter.service.js";

function now() {
  return new Date().toISOString();
}

export async function getLibrary() {
  return getLibraryWithStats();
}

export async function importManga(sourceId: string, sourceMangaId: string) {
  const source = getSource(sourceId);
  const remoteManga = await source.getManga(sourceMangaId);

  const existing = db
    .select()
    .from(manga)
    .where(
      and(
        eq(manga.sourceId, sourceId),
        eq(manga.sourceMangaId, sourceMangaId),
      ),
    )
    .get();

  const timestamp = now();
  const mangaId = existing?.id ?? randomUUID();

  if (existing) {
    db.update(manga)
      .set({
        title: remoteManga.title,
        description: remoteManga.description,
        coverUrl: remoteManga.coverUrl,
        updatedAt: timestamp,
      })
      .where(eq(manga.id, mangaId))
      .run();
  } else {
    db.insert(manga)
      .values({
        id: mangaId,
        sourceId,
        sourceMangaId,
        title: remoteManga.title,
        description: remoteManga.description,
        coverUrl: remoteManga.coverUrl,
        tracked: true,
        autoDownload: false,
        lastCheckedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  }

  await refreshManga(mangaId, { initialImport: true, });
  await cacheMangaCover(mangaId).catch(() => null);

  return getManga(mangaId);
}

export async function cacheMangaCover(mangaId: string) {
  const localManga = db.select().from(manga).where(eq(manga.id, mangaId)).get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  if (!localManga.coverUrl) {
    return {
      cached: false,
      reason: "No remote cover URL",
    };
  }

  const filePath = getCoverFilePath({
    sourceId: localManga.sourceId,
    sourceMangaId: localManga.sourceMangaId,
    remoteUrl: localManga.coverUrl,
  });

  const localUrl = getCoverLocalUrl({
    sourceId: localManga.sourceId,
    sourceMangaId: localManga.sourceMangaId,
    remoteUrl: localManga.coverUrl,
  });

  if (!isUsableDownloadedFile(filePath)) {
    await downloadFileToPath(localManga.coverUrl, filePath);
  }

  db.update(manga)
    .set({
      localCoverPath: filePath,
      localCoverUrl: localUrl,
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return {
    cached: true,
    localCoverPath: filePath,
    localCoverUrl: localUrl,
  };
}

export async function updateMangaDisplayTitle(
  mangaId: string,
  displayTitle: string | null,
) {
  db.update(manga)
    .set({
      displayTitle: displayTitle?.trim() || null,
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return getManga(mangaId);
}

export async function verifyAllChapters(mangaId: string) {
  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  const results = [];

  for (const chapter of localChapters) {
    results.push(await verifyChapter(chapter.id));
  }

  return {
    mangaId,
    checkedCount: results.length,
    brokenCount: results.filter((result) => !result.verified).length,
    results,
  };
}

export async function repairAllChapters(mangaId: string) {
  const verification = await verifyAllChapters(mangaId);

  const brokenChapterIds = verification.results
    .filter((result) => !result.verified)
    .map((result) => result.chapterId);

  const results = [];

  for (const chapterId of brokenChapterIds) {
    results.push(await repairChapter(chapterId));
  }

  return {
    mangaId,
    repairedCount: results.length,
    results,
  };
}

export async function markAllChaptersRead(mangaId: string) {
  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  for (const chapter of localChapters) {
    await markChapterRead(chapter.id);
  }

  return getManga(mangaId);
}

export async function markAllChaptersUnread(mangaId: string) {
  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  for (const chapter of localChapters) {
    await markChapterUnread(chapter.id);
  }

  return getManga(mangaId);
}

export async function refreshManga(mangaId: string, options?: { initialImport?: boolean },) {
  const localManga = db.select().from(manga).where(eq(manga.id, mangaId)).get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  const source = getSource(localManga.sourceId);
  const config = await getConfig();

  logger.info("Refreshing manga metadata", {
    mangaId,
    sourceId: localManga.sourceId,
    title: localManga.title,
  });

  const remoteChapters = await runRateLimited(
    localManga.sourceId,
    config.requestDelayMs,
    () => source.getChapters(localManga.sourceMangaId),
  );

  let newChapterCount = 0;

  for (const remoteChapter of remoteChapters) {
    const existing = db
      .select()
      .from(chapters)
      .where(eq(chapters.sourceChapterId, remoteChapter.sourceChapterId))
      .get();

    const timestamp = now();

    if (existing) {
      db.update(chapters)
        .set({
          title: remoteChapter.title,
          chapterNumber: remoteChapter.chapterNumber,
          language: remoteChapter.language,
          publishedAt: remoteChapter.publishedAt,
          updatedAt: timestamp,
        })
        .where(eq(chapters.id, existing.id))
        .run();
    } else {
      newChapterCount++;

      db.insert(chapters)
        .values({
          id: randomUUID(),
          mangaId,
          sourceChapterId: remoteChapter.sourceChapterId,
          title: remoteChapter.title,
          chapterNumber: remoteChapter.chapterNumber,
          language: remoteChapter.language,
          publishedAt: remoteChapter.publishedAt,
          downloadStatus: "not_downloaded",
          readStatus: "unread",
          lastReadPageIndex: 0,
          lastReadAt: null,
          downloadedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          isInitialImport: options?.initialImport ?? false,
        })
        .run();
    }
  }

  db.update(manga)
    .set({
      lastCheckedAt: now(),
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return {
    manga: await getManga(mangaId),
    newChapterCount,
  };
}

export async function getManga(mangaId: string) {
  const localManga = db.select().from(manga).where(eq(manga.id, mangaId)).get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  return {
  ...localManga,
  title: localManga.displayTitle || localManga.title,
  originalTitle: localManga.title,
  coverUrl: localManga.localCoverUrl || localManga.coverUrl,
  chapters: localChapters,
};
}

export async function setMangaTracking(params: {
  mangaId: string;
  tracked?: boolean;
  autoDownload?: boolean;
}) {
  db.update(manga)
    .set({
      tracked: params.tracked,
      autoDownload: params.autoDownload,
      updatedAt: now(),
    })
    .where(eq(manga.id, params.mangaId))
    .run();

  return getManga(params.mangaId);
}

export async function downloadMissingChapters(mangaId: string) {
  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  const missing = localChapters.filter(
    (chapter) => chapter.downloadStatus !== "downloaded",
  );

  const results = [];

  for (const chapter of missing) {
    results.push(await downloadChapter(chapter.id));
  }

  return {
    mangaId,
    downloadedCount: results.filter((result) => result.status === "downloaded")
      .length,
    failedCount: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export async function unfollowManga(mangaId: string) {
  db.update(manga)
    .set({
      tracked: false,
      autoDownload: false,
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return getManga(mangaId);
}

export async function followManga(mangaId: string) {
  db.update(manga)
    .set({
      tracked: true,
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return getManga(mangaId);
}

export async function deleteMangaFromLibrary(mangaId: string) {
  const localManga = db.select().from(manga).where(eq(manga.id, mangaId)).get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  const localChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.mangaId, mangaId))
    .all();

  for (const chapter of localChapters) {
    db.delete(pages).where(eq(pages.chapterId, chapter.id)).run();
  }

  db.delete(chapters).where(eq(chapters.mangaId, mangaId)).run();
  db.delete(manga).where(eq(manga.id, mangaId)).run();

  deleteMangaMedia({
    sourceId: localManga.sourceId,
    sourceMangaId: localManga.sourceMangaId,
  });

  return {
    deleted: true,
    mangaId,
    title: localManga.title,
  };
}

export async function updateMangaReaderSettings(
  mangaId: string,
  settings: {
    readerDirection?: string | null;
    readerClickMode?: string | null;
    readerPageFit?: string | null;
    readerCustomWidth?: number | null;
    readerCustomHeight?: number | null;
    readerPagePadding?: number | null;
  },
) {
  db.update(manga)
    .set({
      ...settings,
      updatedAt: now(),
    })
    .where(eq(manga.id, mangaId))
    .run();

  return getManga(mangaId);
}

export async function getLibraryWithStats() {
  const allManga = db.select().from(manga).all();
  const allChapters = db.select().from(chapters).all();

  return allManga.map((item) => {
    const mangaChapters = allChapters.filter((c) => c.mangaId === item.id);

    const unreadChapterCount = mangaChapters.filter(
      (c) => c.readStatus !== "read",
    ).length;

    const latestChapterAt =
      mangaChapters
        .map((c) => c.publishedAt ?? c.createdAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const recentlyReadAt =
      mangaChapters
        .map((c) => c.lastReadAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const failedChapterCount = mangaChapters.filter(
      (c) => c.downloadStatus === "failed" || c.downloadStatus === "partial",
    ).length;

    return {
      ...item,
      title: item.displayTitle || item.title,
      originalTitle: item.title,
      coverUrl: item.localCoverUrl || item.coverUrl,
      unreadChapterCount,
      failedChapterCount,
      latestChapterAt,
      recentlyReadAt,
      chapterCount: mangaChapters.length,
    };
  });
}

export async function getRecentUpdates() {
  const allManga = db.select().from(manga).all();
  const allChapters = db.select().from(chapters).all();

  return allChapters
    .filter((chapter) => !chapter.isInitialImport)
    .map((chapter) => {
      const parent = allManga.find((m) => m.id === chapter.mangaId);

      return {
        ...chapter,
        manga: parent
          ? {
            id: parent.id,
            title: parent.title,
            coverUrl: parent.coverUrl,
            sourceId: parent.sourceId,
          }
          : null,
        detectedAt: chapter.createdAt,
        releasedAt: chapter.publishedAt,
      };
    })
    .sort((a, b) => {
      const aDate = a.detectedAt ?? a.releasedAt ?? "";
      const bDate = b.detectedAt ?? b.releasedAt ?? "";

      return bDate.localeCompare(aDate);
    })
    .slice(0, 200);
}

export async function checkAllTrackedManga(setMessage?: (message: string) => void,) {
  const config = await getConfig();

  const trackedManga = db
    .select()
    .from(manga)
    .where(eq(manga.tracked, true))
    .all();

  const results = [];

  for (const item of trackedManga) {
    setMessage?.(`Checking ${item.title}...`);

    const refreshResult = await refreshManga(item.id);

    if (item.autoDownload) {
      setMessage?.(`Downloading missing chapters for ${item.title}...`);

      const downloadResult = await downloadMissingChapters(item.id);

      results.push({
        mangaId: item.id,
        title: item.title,
        refreshResult,
        downloadResult,
      });
    } else {
      results.push({
        mangaId: item.id,
        title: item.title,
        refreshResult,
        downloadResult: null,
      });
    }

    await runRateLimited(item.sourceId, config.requestDelayMs, async () => {
      return undefined;
    });
  }

  return {
    checkedCount: trackedManga.length,
    results,
  };
}