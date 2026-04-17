/**
 * Log levels ordered by severity (lowest to highest).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * A log handler function signature.
 */
export type LogHandler = (level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>) => void;

/**
 * Configuration for the logger.
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: 'silent') */
  level?: LogLevel;

  /** Custom log handler — overrides the default console logger */
  handler?: LogHandler;

  /** Prefix prepended to all messages (default: '[tempmail-checker]') */
  prefix?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Lightweight, configurable logger for tempmail-checker.
 *
 * Supports log levels (debug, info, warn, error, silent) and custom handlers.
 * Defaults to silent — opt-in via `level` option or `TEMPMAIL_LOG_LEVEL` env var.
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug' });
 * logger.debug('Checking domain', { domain: 'tempmail.com' });
 * ```
 */
export class Logger {
  private level: LogLevel;
  private handler: LogHandler;
  private prefix: string;

  constructor(options?: LoggerOptions) {
    this.prefix = options?.prefix ?? '[tempmail-checker]';
    this.level = options?.level ?? this.getEnvLogLevel() ?? 'silent';
    this.handler = options?.handler ?? this.defaultHandler.bind(this);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Update the log level at runtime.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  private log(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }
    this.handler(level, message, meta);
  }

  private defaultHandler(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>): void {
    const formatted = `${this.prefix} ${level.toUpperCase()} ${message}`;
    const args: unknown[] = meta !== undefined ? [formatted, meta] : [formatted];

    switch (level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  private getEnvLogLevel(): LogLevel | undefined {
    try {
      // Works in Node.js; silently fails in browsers without process
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const envLevel = (g.process?.env?.['TEMPMAIL_LOG_LEVEL'] as string | undefined) || undefined;
      if (envLevel && envLevel in LEVEL_PRIORITY) {
        return envLevel as LogLevel;
      }
    } catch {
      // Ignore — browser environment without process
    }
    return undefined;
  }
}

/**
 * Create a new Logger instance.
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
