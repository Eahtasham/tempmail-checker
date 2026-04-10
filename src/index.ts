// ─── Class-based API ───────────────────────────────────────────────
export { EmailValidator } from './validator';

// ─── Functional API ────────────────────────────────────────────────
export { isDisposable, isTemp } from './check';

// ─── Types ─────────────────────────────────────────────────────────
export type { ValidationResult, ValidatorOptions, ValidatorStats } from './types';

// ─── Advanced / Utilities ──────────────────────────────────────────
export { BloomFilter } from './bloom-filter';
export { fetchLatestDomains, rebuildFromDomains } from './updater';
export { parseEmail } from './email-parser';
export { getDomainLevels } from './subdomain';
export { murmurhash3_32 } from './hash';
