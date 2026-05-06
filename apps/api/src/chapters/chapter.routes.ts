import { Hono } from "hono";
import {
  downloadChapter,
  getChapterPages,
  markChapterRead,
  markChapterUnread,
  redownloadChapter,
  repairChapter,
  updateChapterReadProgress,
  verifyChapter,
  enqueueChapterDownload,
} from "./chapter.service.js";

export const chapterRoutes = new Hono();

chapterRoutes.get("/:chapterId/pages", async (c) => {
  return c.json(await getChapterPages(c.req.param("chapterId")));
});

chapterRoutes.post("/:chapterId/download", async (c) => {
  return c.json(enqueueChapterDownload(c.req.param("chapterId")));
});

chapterRoutes.post("/:chapterId/progress", async (c) => {
  const body = await c.req.json();

  if (typeof body.pageIndex !== "number") {
    return c.json({ error: "pageIndex is required" }, 400);
  }

  return c.json(
    await updateChapterReadProgress({
      chapterId: c.req.param("chapterId"),
      pageIndex: body.pageIndex,
    }),
  );
});

chapterRoutes.post("/:chapterId/mark-read", async (c) => {
  return c.json(await markChapterRead(c.req.param("chapterId")));
});

chapterRoutes.post("/:chapterId/mark-unread", async (c) => {
  return c.json(await markChapterUnread(c.req.param("chapterId")));
});

chapterRoutes.get("/:chapterId/verify", async (c) => {
  return c.json(await verifyChapter(c.req.param("chapterId")));
});

chapterRoutes.post("/:chapterId/repair", async (c) => {
  return c.json(
    enqueueChapterDownload(c.req.param("chapterId"), {
      repairOnly: true,
    }),
  );
});

chapterRoutes.post("/:chapterId/redownload", async (c) => {
  return c.json(
    enqueueChapterDownload(c.req.param("chapterId"), {
      force: true,
    }),
  );
});