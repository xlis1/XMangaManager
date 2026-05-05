type LogLevel = "debug" | "info" | "warn" | "error";

function timestamp() {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, meta?: unknown) {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;

  if (meta) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};