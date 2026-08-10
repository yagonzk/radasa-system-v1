import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = (env.LOG_LEVEL in levels ? env.LOG_LEVEL : "info") as LogLevel;

function write(level: LogLevel, first?: unknown, second?: string) {
  if (levels[level] < levels[configuredLevel]) return;
  const message = second ?? (typeof first === "string" ? first : undefined);
  const details = typeof first === "string" ? undefined : first;
  console[level]({ level, message, details, timestamp: new Date().toISOString() });
}

export const logger = {
  debug: (first?: unknown, second?: string) => write("debug", first, second),
  info: (first?: unknown, second?: string) => write("info", first, second),
  warn: (first?: unknown, second?: string) => write("warn", first, second),
  error: (first?: unknown, second?: string) => write("error", first, second),
};
