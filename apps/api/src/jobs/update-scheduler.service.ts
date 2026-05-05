import { getConfig } from "../config/config.service.js";
import { checkAllTrackedManga } from "../library/library.service.js";
import { logger } from "../utils/logger.js";
import { getJobState, runExclusiveJob } from "./job-state.service.js";

let interval: NodeJS.Timeout | null = null;

export async function startUpdateScheduler() {
  const config = await getConfig();

  if (config.autoCheckOnStartup) {
    void runScheduledCheck("startup");
  }

  scheduleNextInterval(config.updateIntervalMinutes);
}

export function scheduleNextInterval(minutes: number) {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  if (!Number.isFinite(minutes) || minutes <= 0) {
    logger.info("Automatic update scheduler disabled");
    return;
  }

  const delayMs = minutes * 60 * 1000;

  interval = setInterval(() => {
    void runScheduledCheck("interval");
  }, delayMs);

  logger.info("Automatic update scheduler started", {
    updateIntervalMinutes: minutes,
  });
}

async function runScheduledCheck(reason: "startup" | "interval") {
  const state = getJobState();

  if (state.status === "running") {
    logger.warn("Skipping scheduled check because another job is running", {
      activeJob: state.jobName,
      reason,
    });

    return;
  }

  try {
    logger.info("Starting scheduled update check", { reason });

    await runExclusiveJob(`scheduled-check-all-${reason}`, async (setMessage) => {
      setMessage(`Scheduled update check: ${reason}`);
      return checkAllTrackedManga(setMessage);
    });

    logger.info("Scheduled update check completed", { reason });
  } catch (error) {
    logger.error("Scheduled update check failed", {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}