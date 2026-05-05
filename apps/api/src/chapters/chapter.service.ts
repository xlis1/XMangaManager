import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import { chapters, manga, pages } from "../db/schema.js";
import { getSource } from "../sources/index.js";
import { getConfig } from "../config/config.service.js";
import { runRateLimited, sleep } from "../utils/rate-limit.js";
import {
  deleteFileIfExists,
  downloadFileToPath,
  getPageFilePath,
  getPageLocalUrl,
  isUsableDownloadedFile,
} from "../storage/media-storage.service.js";
import { logger } from "../utils/logger.js";

function now() {
  return new Date().toISOString();
}

export async function getChapterPages(chapterId: string) {
  const existingPages = db
    .select()
    .from(pages)
    .where(eq(pages.chapterId, chapterId))
    .all()
    .sort((a, b) => a.pageIndex - b.pageIndex);

  if (existingPages.length > 0) {
    /*logger.debug("Serving chapter pages from local database", {
      chapterId,
      pageCount: existingPages.length,
    });
    */
    return existingPages;
  }

  logger.warn("Chapter pages not stored locally; scraping source pages", {
    chapterId,
  });

  return scrapeAndStoreChapterPages(chapterId);
}

export async function scrapeAndStoreChapterPages(chapterId: string) {
  const chapter = db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .get();

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const localManga = db
    .select()
    .from(manga)
    .where(eq(manga.id, chapter.mangaId))
    .get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  const source = getSource(localManga.sourceId);
  const config = await getConfig();

  const remotePages = await runRateLimited(
    localManga.sourceId,
    config.requestDelayMs,
    () => source.getChapterPages(chapter.sourceChapterId),
  );

  const timestamp = now();

  for (const page of remotePages) {
    db.insert(pages)
      .values({
        id: randomUUID(),
        chapterId,
        pageIndex: page.index,
        remoteUrl: page.url,
        localPath: null,
        localUrl: null,
        downloadStatus: "not_downloaded",
        downloadError: null,
        downloadedAt: null,
        createdAt: timestamp,
      })
      .onConflictDoNothing()
      .run();
  }

  return db
    .select()
    .from(pages)
    .where(eq(pages.chapterId, chapterId))
    .all()
    .sort((a, b) => a.pageIndex - b.pageIndex);
}

export async function downloadChapter(chapterId: string, options?: { force?: boolean; repairOnly?: boolean; },) {
  const config = await getConfig();
  const chapter = db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .get();


  if (!chapter) {
    throw new Error("Chapter not found");
  }

  logger.info("Downloading chapter", {
    chapterId,
    sourceChapterId: chapter.sourceChapterId,
  });

  const localManga = db
    .select()
    .from(manga)
    .where(eq(manga.id, chapter.mangaId))
    .get();

  if (!localManga) {
    throw new Error("Manga not found");
  }

  db.update(chapters)
    .set({
      downloadStatus: "pending",
      updatedAt: now(),
    })
    .where(eq(chapters.id, chapterId))
    .run();

  const chapterPages = await getChapterPages(chapterId);

  let failed = 0;

  for (const page of chapterPages) {
    const filePath = getPageFilePath({
      sourceId: localManga.sourceId,
      sourceMangaId: localManga.sourceMangaId,
      sourceChapterId: chapter.sourceChapterId,
      pageIndex: page.pageIndex,
      remoteUrl: page.remoteUrl,
    });

    const localUrl = getPageLocalUrl({
      sourceId: localManga.sourceId,
      sourceMangaId: localManga.sourceMangaId,
      sourceChapterId: chapter.sourceChapterId,
      pageIndex: page.pageIndex,
      remoteUrl: page.remoteUrl,
    });

    const alreadyUsable = isUsableDownloadedFile(page.localPath);

    if (!options?.force && alreadyUsable && page.downloadStatus === "downloaded") {
      continue;
    }

    if (options?.repairOnly && alreadyUsable && page.downloadStatus === "downloaded") {
      continue;
    }

    if (options?.force) {
      deleteFileIfExists(page.localPath);
    }

    try {
      db.update(pages)
        .set({
          downloadStatus: "pending",
          downloadError: null,
        })
        .where(eq(pages.id, page.id))
        .run();

      await downloadFileToPath(page.remoteUrl, filePath);

      db.update(pages)
        .set({
          localPath: filePath,
          localUrl,
          downloadStatus: "downloaded",
          downloadError: null,
          downloadedAt: now(),
        })
        .where(eq(pages.id, page.id))
        .run();
    } catch (error) {
      failed++;
      logger.error("Page download failed", {
        pageId: page.id,
        remoteUrl: page.remoteUrl,
        error,
      });

      db.update(pages)
        .set({
          downloadStatus: "failed",
          downloadError:
            error instanceof Error ? error.message : "Unknown download error",
        })
        .where(eq(pages.id, page.id))
        .run();
    }

    await sleep(config.chapterDownloadDelayMs);
  }

  const verification = await verifyChapter(chapterId);

  db.update(chapters)
    .set({
      downloadStatus: verification.verified
        ? "downloaded"
        : failed > 0
          ? "failed"
          : "partial",
      downloadedAt: verification.verified ? now() : null,
      updatedAt: now(),
    })
    .where(eq(chapters.id, chapterId))
    .run();

  return {
    chapterId,
    totalPages: chapterPages.length,
    failedPages: failed,
    status: verification.verified
      ? "downloaded"
      : failed > 0
        ? "failed"
        : "partial",
    verification,
  };
}


export async function updateChapterReadProgress(params: {
  chapterId: string;
  pageIndex: number;
}) {
  const chapter = db
    .select()
    .from(chapters)
    .where(eq(chapters.id, params.chapterId))
    .get();

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  db.update(chapters)
    .set({
      readStatus: "reading",
      lastReadPageIndex: params.pageIndex,
      lastReadAt: now(),
      updatedAt: now(),
    })
    .where(eq(chapters.id, params.chapterId))
    .run();

  return db
    .select()
    .from(chapters)
    .where(eq(chapters.id, params.chapterId))
    .get();
}

export async function markChapterRead(chapterId: string) {
  db.update(chapters)
    .set({
      readStatus: "read",
      lastReadAt: now(),
      updatedAt: now(),
    })
    .where(eq(chapters.id, chapterId))
    .run();

  return db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
}

export async function markChapterUnread(chapterId: string) {
  db.update(chapters)
    .set({
      readStatus: "unread",
      lastReadPageIndex: 0,
      lastReadAt: null,
      updatedAt: now(),
    })
    .where(eq(chapters.id, chapterId))
    .run();

  return db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
}

export async function verifyChapter(chapterId: string) {
  const chapter = db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .get();

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const chapterPages = await getChapterPages(chapterId);

  const brokenPages = chapterPages.filter((page) => {
    if (page.downloadStatus !== "downloaded") return true;
    if (!page.localPath) return true;
    if (!page.localUrl) return true;

    return !isUsableDownloadedFile(page.localPath);
  });

  const verified = chapterPages.length > 0 && brokenPages.length === 0;

  if (!verified && chapter.downloadStatus === "downloaded") {
    db.update(chapters)
      .set({
        downloadStatus: "partial",
        updatedAt: now(),
      })
      .where(eq(chapters.id, chapterId))
      .run();
  }

  return {
    chapterId,
    verified,
    totalPages: chapterPages.length,
    brokenPageCount: brokenPages.length,
    brokenPages: brokenPages.map((page) => ({
      id: page.id,
      pageIndex: page.pageIndex,
      downloadStatus: page.downloadStatus,
      localPath: page.localPath,
      localUrl: page.localUrl,
    })),
  };
}

export async function repairChapter(chapterId: string) {
  const verification = await verifyChapter(chapterId);

  if (verification.verified) {
    return {
      chapterId,
      repaired: false,
      message: "Chapter already verified",
      verification,
    };
  }

  const result = await downloadChapter(chapterId, {
    force: false,
    repairOnly: true,
  });

  const after = await verifyChapter(chapterId);

  return {
    chapterId,
    repaired: true,
    downloadResult: result,
    verification: after,
  };
}

export async function redownloadChapter(chapterId: string) {
  return downloadChapter(chapterId, {
    force: true,
    repairOnly: false,
  });
}