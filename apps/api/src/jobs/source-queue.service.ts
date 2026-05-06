import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

export type SourceQueueJobStatus = "queued" | "running" | "completed" | "failed";

export type SourceQueueJob = {
  id: string;
  sourceId: string;
  name: string;
  status: SourceQueueJobStatus;
  message: string;
  progressCurrent: number;
  progressTotal: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

type InternalJob<T> = SourceQueueJob & {
  task: (helpers: SourceQueueJobHelpers) => Promise<T>;
};

export type SourceQueueJobHelpers = {
  setMessage: (message: string) => void;
  setProgress: (current: number, total: number) => void;
};

const queues = new Map<string, InternalJob<unknown>[]>();
const running = new Map<string, boolean>();
const activeJobs = new Map<string, InternalJob<unknown>>();
const history: SourceQueueJob[] = [];

const MAX_HISTORY = 100;

function publicJob(job: InternalJob<unknown>): SourceQueueJob {
  const { task: _task, ...rest } = job;
  return rest;
}

function remember(job: InternalJob<unknown>) {
  history.unshift(publicJob(job));

  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
}

export function enqueueSourceJob<T>(params: {
  sourceId: string;
  name: string;
  task: (helpers: SourceQueueJobHelpers) => Promise<T>;
}) {
  const job: InternalJob<T> = {
    id: randomUUID(),
    sourceId: params.sourceId,
    name: params.name,
    status: "queued",
    message: "Queued",
    progressCurrent: 0,
    progressTotal: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
    task: params.task,
  };

  const sourceQueue = queues.get(params.sourceId) ?? [];
  sourceQueue.push(job as InternalJob<unknown>);
  queues.set(params.sourceId, sourceQueue);

  logger.info("Queued source job", {
    sourceId: params.sourceId,
    jobId: job.id,
    name: job.name,
    queueLength: sourceQueue.length,
  });

  void processQueue(params.sourceId);

  return publicJob(job as InternalJob<unknown>);
}

async function processQueue(sourceId: string) {
  if (running.get(sourceId)) return;

  running.set(sourceId, true);

  try {
    while ((queues.get(sourceId)?.length ?? 0) > 0) {
      const job = queues.get(sourceId)!.shift()!;

      job.status = "running";
      job.startedAt = new Date().toISOString();
      job.message = "Running";
      activeJobs.set(sourceId, job);

      logger.info("Starting source job", {
        sourceId,
        jobId: job.id,
        name: job.name,
      });

      try {
        await job.task({
          setMessage: (message) => {
            job.message = message;
          },
          setProgress: (current, total) => {
            job.progressCurrent = current;
            job.progressTotal = total;
          },
        });

        job.status = "completed";
        job.message = "Completed";
        job.finishedAt = new Date().toISOString();

        logger.info("Completed source job", {
          sourceId,
          jobId: job.id,
          name: job.name,
        });
      } catch (error) {
        job.status = "failed";
        job.message = "Failed";
        job.error = error instanceof Error ? error.message : String(error);
        job.finishedAt = new Date().toISOString();

        logger.error("Source job failed", {
          sourceId,
          jobId: job.id,
          name: job.name,
          error: job.error,
        });
      } finally {
        remember(job);
        activeJobs.delete(sourceId);
      }
    }
  } finally {
    running.set(sourceId, false);
  }
}

export function getSourceQueueStatus() {
  const sourceIds = new Set([
    ...queues.keys(),
    ...activeJobs.keys(),
  ]);

  const activeQueues = [...sourceIds].map((sourceId) => {
    const queuedJobs = queues.get(sourceId) ?? [];
    const activeJob = activeJobs.get(sourceId);

    return {
      sourceId,
      running: Boolean(activeJob),
      activeJob: activeJob ? publicJob(activeJob) : null,
      queuedCount: queuedJobs.length,
      queuedJobs: queuedJobs.map(publicJob),
    };
  });

  return {
    queues: activeQueues,
    recentJobs: history,
  };
}