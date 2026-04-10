import { EmailValidator } from './validator';
import type { ValidationResult } from './types';

/**
 * Lazily-initialized module-level singleton validator.
 * Created on first use, shared across all calls to isDisposable() and isTemp().
 */
let _defaultValidator: EmailValidator | undefined;

function getDefaultValidator(): EmailValidator {
  if (!_defaultValidator) {
    _defaultValidator = new EmailValidator();
  }
  return _defaultValidator;
}

/**
 * Quick check whether an email address uses a disposable/temporary domain.
 *
 * Uses a lazily-initialized singleton `EmailValidator` with default settings.
 * For custom blocklists, allowlists, or auto-refresh, use the `EmailValidator`
 * class directly.
 *
 * @example
 * ```typescript
 * import { isDisposable } from 'tempmail-checker';
 *
 * const result = isDisposable('user@tempmail.com');
 * if (result.disposable) {
 *   console.log(`Blocked: ${result.reason}`);
 * }
 * ```
 *
 * @param email - The email address to check
 * @returns A rich validation result object
 */
export function isDisposable(email: string): ValidationResult {
  return getDefaultValidator().check(email);
}

/**
 * Quick boolean check — returns `true` if the email uses a disposable domain.
 *
 * Convenience wrapper over `isDisposable()` for simple use cases.
 *
 * @example
 * ```typescript
 * import { isTemp } from 'tempmail-checker';
 *
 * if (isTemp('user@guerrillamail.com')) {
 *   throw new Error('Temporary emails are not allowed');
 * }
 * ```
 *
 * @param email - The email address to check
 * @returns `true` if the email domain is disposable, `false` otherwise
 */
export function isTemp(email: string): boolean {
  return getDefaultValidator().check(email).disposable;
}
