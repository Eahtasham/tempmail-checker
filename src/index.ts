// ─── Class-based API ───────────────────────────────────────────────
export { EmailValidator } from './validator';

// ─── Functional API ────────────────────────────────────────────────
export { isDisposable, isTemp } from './check';

// ─── Logging ───────────────────────────────────────────────────────
export { Logger, createLogger } from './logger';
export type { LogLevel, LogHandler, LoggerOptions } from './logger';

// ─── Types ─────────────────────────────────────────────────────────
export type { ValidationResult, ValidatorOptions, ValidatorStats } from './types';

// ─── Middleware ────────────────────────────────────────────────────
export { createExpressMiddleware } from './middleware/express';
export { fastifyTempmail } from './middleware/fastify';
export type { ExpressMiddlewareOptions, EmailValidationRequest } from './middleware/express';
export type { FastifyPluginOptions } from './middleware/fastify';

// ─── Advanced / Utilities ──────────────────────────────────────────
export { BloomFilter } from './bloom-filter';
export { fetchLatestDomains, rebuildFromDomains } from './updater';
export { parseEmail } from './email-parser';
export { getDomainLevels } from './subdomain';
export { murmurhash3_32 } from './hash';
