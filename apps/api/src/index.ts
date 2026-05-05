import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { initDb } from "./db/client.js";
import { configRoutes } from "./config/config.routes.js";
import { libraryRoutes } from "./library/library.routes.js";
import { chapterRoutes } from "./chapters/chapter.routes.js";
import { getSource, getSources } from "./sources/index.js";
import { startUpdateScheduler } from "./jobs/update-scheduler.service.js";
import { jobRoutes } from "./jobs/job.routes.js";
import { runStartupRepair } from "./jobs/startup-repair.service.js";

initDb();
await runStartupRepair();
void startUpdateScheduler();

const app = new Hono();

app.get("/media/*", serveStatic({ root: "./data" }));

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

app.get("/api/sources", (c) => {
  return c.json(getSources());
});

app.get("/api/sources/:sourceId/search", async (c) => {
  const source = getSource(c.req.param("sourceId"));
  const query = c.req.query("q") ?? "";

  if (!query.trim()) {
    return c.json({ error: "Missing search query" }, 400);
  }

  return c.json(await source.searchManga({ query }));
});

app.get("/api/sources/:sourceId/manga/:mangaId", async (c) => {
  const source = getSource(c.req.param("sourceId"));
  return c.json(await source.getManga(c.req.param("mangaId")));
});

app.get("/api/sources/:sourceId/manga/:mangaId/chapters", async (c) => {
  const source = getSource(c.req.param("sourceId"));
  return c.json(await source.getChapters(c.req.param("mangaId")));
});

app.get("/api/sources/:sourceId/chapters/:chapterId/pages", async (c) => {
  const source = getSource(c.req.param("sourceId"));
  return c.json(await source.getChapterPages(c.req.param("chapterId")));
});

app.route("/api/jobs", jobRoutes);
app.route("/api/config", configRoutes);
app.route("/api/library", libraryRoutes);
app.route("/api/chapters", chapterRoutes);

serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("API running on http://localhost:3000");