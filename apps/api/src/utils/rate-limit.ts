const sourceLocks = new Map<string, Promise<void>>();

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runRateLimited<T>(
  sourceId: string,
  delayMs: number,
  task: () => Promise<T>,
): Promise<T> {
  const previous = sourceLocks.get(sourceId) ?? Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  sourceLocks.set(
    sourceId,
    previous.then(() => current),
  );

  await previous;

  try {
    const result = await task();
    await sleep(delayMs);
    return result;
  } finally {
    release();

    if (sourceLocks.get(sourceId) === current) {
      sourceLocks.delete(sourceId);
    }
  }
}