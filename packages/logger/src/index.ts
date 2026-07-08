import pino, { type Logger } from "pino";

export interface LoggerOptions {
  service: string;
  level?: string;
}

export function createLogger({ service, level = "info" }: LoggerOptions): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type { Logger };
