export type JobStatus = "idle" | "running" | "failed" | "completed";

export type JobState = {
  status: JobStatus;
  jobName: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  lastResult: unknown | null;
};

const state: JobState = {
  status: "idle",
  jobName: null,
  message: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  lastResult: null,
};

let activeJob: Promise<unknown> | null = null;

export function getJobState() {
  return state;
}

export async function runExclusiveJob<T>(
  jobName: string,
  task: (setMessage: (message: string) => void) => Promise<T>,
): Promise<T> {
  if (activeJob) {
    throw new Error(`Another job is already running: ${state.jobName}`);
  }

  state.status = "running";
  state.jobName = jobName;
  state.message = "Starting...";
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.lastError = null;
  state.lastResult = null;

  const setMessage = (message: string) => {
    state.message = message;
  };

  activeJob = task(setMessage);

  try {
    const result = await activeJob;

    state.status = "completed";
    state.message = "Completed";
    state.finishedAt = new Date().toISOString();
    state.lastResult = result;

    return result as T;
  } catch (error) {
    state.status = "failed";
    state.message = "Failed";
    state.finishedAt = new Date().toISOString();
    state.lastError = error instanceof Error ? error.message : String(error);

    throw error;
  } finally {
    activeJob = null;
  }
}