import pino from "pino";

export type Logger = pino.Logger;

declare global {
  var __logger: Logger | undefined;
}

export const logger: Logger =
  globalThis.__logger ??
  pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "pipeline-monitor" },
  });

if (process.env.NODE_ENV !== "production") globalThis.__logger = logger;
