import { Hono } from "hono";
import { checkAllTrackedManga } from "../library/library.service.js";
import { getJobState, runExclusiveJob } from "./job-state.service.js";

export const jobRoutes = new Hono();

jobRoutes.get("/status", (c) => {
  return c.json(getJobState());
});

jobRoutes.post("/check-all", async (c) => {
  try {
    const result = await runExclusiveJob("check-all-tracked-manga", async (setMessage) => {
      setMessage("Checking all tracked manga...");
      return checkAllTrackedManga(setMessage);
    });

    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Job failed",
        state: getJobState(),
      },
      409,
    );
  }
});