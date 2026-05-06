import { Hono } from "hono";
import { checkAllTrackedManga } from "../library/library.service.js";
import { getJobState, runExclusiveJob } from "./job-state.service.js";
import { getSourceQueueStatus } from "./source-queue.service.js";
import { enqueueCheckAllTrackedManga } from "../library/library.service.js";

export const jobRoutes = new Hono();

jobRoutes.get("/status", (c) => {
  return c.json(getJobState());
});

jobRoutes.get("/source-queues", (c) => {
  return c.json(getSourceQueueStatus());
});

jobRoutes.post("/check-all", async (c) => {
  return c.json(enqueueCheckAllTrackedManga());
});