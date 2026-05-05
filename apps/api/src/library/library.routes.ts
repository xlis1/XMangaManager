import { Hono } from "hono";
import {
  checkAllTrackedManga,
  deleteMangaFromLibrary,
  downloadMissingChapters,
  followManga,
  getLibrary,
  getManga,
  importManga,
  refreshManga,
  setMangaTracking,
  unfollowManga,
  updateMangaReaderSettings,
  getRecentUpdates,
  cacheMangaCover,
  markAllChaptersRead,
  markAllChaptersUnread,
  repairAllChapters,
  updateMangaDisplayTitle,
  verifyAllChapters,
} from "./library.service.js";

export const libraryRoutes = new Hono();

libraryRoutes.get("/", async (c) => {
  return c.json(await getLibrary());
});

libraryRoutes.post("/:mangaId/cache-cover", async (c) => {
  return c.json(await cacheMangaCover(c.req.param("mangaId")));
});

libraryRoutes.put("/:mangaId/display-title", async (c) => {
  const body = await c.req.json();

  return c.json(
    await updateMangaDisplayTitle(
      c.req.param("mangaId"),
      typeof body.displayTitle === "string" ? body.displayTitle : null,
    ),
  );
});

libraryRoutes.post("/:mangaId/verify-all", async (c) => {
  return c.json(await verifyAllChapters(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/repair-all", async (c) => {
  return c.json(await repairAllChapters(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/mark-all-read", async (c) => {
  return c.json(await markAllChaptersRead(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/mark-all-unread", async (c) => {
  return c.json(await markAllChaptersUnread(c.req.param("mangaId")));
});

libraryRoutes.post("/import", async (c) => {
  const body = await c.req.json();

  if (!body.sourceId || !body.sourceMangaId) {
    return c.json({ error: "sourceId and sourceMangaId are required" }, 400);
  }

  return c.json(await importManga(body.sourceId, body.sourceMangaId));
});

libraryRoutes.post("/check-all", async (c) => {
  return c.json(await checkAllTrackedManga());
});

libraryRoutes.get("/updates", async (c) => {
  return c.json(await getRecentUpdates());
});

libraryRoutes.get("/:mangaId", async (c) => {
  return c.json(await getManga(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/refresh", async (c) => {
  return c.json(await refreshManga(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/download-missing", async (c) => {
  return c.json(await downloadMissingChapters(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/follow", async (c) => {
  return c.json(await followManga(c.req.param("mangaId")));
});

libraryRoutes.post("/:mangaId/unfollow", async (c) => {
  return c.json(await unfollowManga(c.req.param("mangaId")));
});

libraryRoutes.delete("/:mangaId", async (c) => {
  return c.json(await deleteMangaFromLibrary(c.req.param("mangaId")));
});
libraryRoutes.post("/:mangaId/tracking", async (c) => {
  const body = await c.req.json();

  return c.json(
    await setMangaTracking({
      mangaId: c.req.param("mangaId"),
      tracked: body.tracked,
      autoDownload: body.autoDownload,
    }),
  );
});

libraryRoutes.put("/:mangaId/reader-settings", async (c) => {
  const body = await c.req.json();

  return c.json(
    await updateMangaReaderSettings(c.req.param("mangaId"), {
      readerDirection: body.readerDirection,
      readerClickMode: body.readerClickMode,
      readerPageFit: body.readerPageFit,
      readerCustomWidth: body.readerCustomWidth,
      readerCustomHeight: body.readerCustomHeight,
      readerPagePadding: body.readerPagePadding,
    }),
  );
});