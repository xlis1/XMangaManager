import { Hono } from "hono";
import { getConfig, updateConfig } from "./config.service.js";
import { scheduleNextInterval } from "../jobs/update-scheduler.service.js";

export const configRoutes = new Hono();

configRoutes.get("/", async (c) => {
  return c.json(await getConfig());
});

configRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const config = await updateConfig(body);

  if (typeof body.updateIntervalMinutes === "number") {
    scheduleNextInterval(body.updateIntervalMinutes);
  }

  return c.json(config);
});