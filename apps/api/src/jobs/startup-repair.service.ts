import { db } from "../db/client.js";
import { chapters, pages } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";

export async function runStartupRepair() {
  logger.info("Running startup repair pass");

  // Fix chapters stuck in downloading
  const stuckChapters = db
    .select()
    .from(chapters)
    .where(eq(chapters.downloadStatus, "downloading"))
    .all();

  for (const chapter of stuckChapters) {
    db.update(chapters)
      .set({
        downloadStatus: "partial",
      })
      .where(eq(chapters.id, chapter.id))
      .run();
  }

  logger.info("Fixed stuck chapters", {
    count: stuckChapters.length,
  });

  // Fix pages stuck in downloading
  const stuckPages = db
    .select()
    .from(pages)
    .where(eq(pages.downloadStatus, "downloading"))
    .all();

  for (const page of stuckPages) {
    db.update(pages)
      .set({
        downloadStatus: "not_downloaded",
        localPath: null,
        localUrl: null,
      })
      .where(eq(pages.id, page.id))
      .run();
  }

  logger.info("Fixed stuck pages", {
    count: stuckPages.length,
  });

  logger.info("Startup repair complete");
}