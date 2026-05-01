/**
 * logger.ts
 * Lightweight plugin logger that respects the configured log level.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

export class PluginLogger {
  private readonly prefix: string;
  private level: LogLevel;

  constructor(prefix = "[SSS]", level: LogLevel = "info") {
    this.prefix = prefix;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(lvl: LogLevel): boolean {
    return LEVELS[lvl] >= LEVELS[this.level];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) console.debug(this.prefix, ...args);
  }

  info(...args: unknown[]): void {
    if (this.shouldLog("info")) console.info(this.prefix, ...args);
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) console.warn(this.prefix, ...args);
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) console.error(this.prefix, ...args);
  }
}

export const logger = new PluginLogger("[SSS]");
