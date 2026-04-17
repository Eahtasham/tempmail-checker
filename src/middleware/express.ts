import { EmailValidator } from '../validator';
import type { ValidationResult, ValidatorOptions } from '../types';

/**
 * Options for the Express middleware.
 */
export interface ExpressMiddlewareOptions extends ValidatorOptions {
  /**
   * Which request field(s) to extract the email from.
   * Supports dot notation for nested fields (e.g. 'body.email', 'query.email').
   * Default: ['body.email']
   */
  emailFields?: string[];

  /**
   * If true, block the request with 422 when a disposable email is detected.
   * If false, attach the result to `req.emailValidation` and call next().
   * Default: true
   */
  blockDisposable?: boolean;

  /**
   * Custom error message returned when a disposable email is blocked.
   * Default: 'Disposable email addresses are not allowed.'
   */
  errorMessage?: string;

  /**
   * HTTP status code returned when a disposable email is blocked.
   * Default: 422
   */
  errorStatusCode?: number;
}

/**
 * Augments the Express Request with email validation results.
 */
export interface EmailValidationRequest {
  emailValidation?: ValidationResult[];
}

/**
 * Resolve a dot-notation path on an object (e.g. 'body.email' → obj.body.email).
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current != null && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Create an Express middleware that validates emails in incoming requests.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createExpressMiddleware } from 'tempmail-checker/middleware/express';
 *
 * const app = express();
 * app.use(express.json());
 *
 * // Block disposable emails in POST body
 * app.post('/register',
 *   createExpressMiddleware({ emailFields: ['body.email'] }),
 *   (req, res) => { res.json({ ok: true }); }
 * );
 *
 * // Attach results without blocking
 * app.post('/check',
 *   createExpressMiddleware({ blockDisposable: false }),
 *   (req, res) => { res.json(req.emailValidation); }
 * );
 * ```
 */
export function createExpressMiddleware(options?: ExpressMiddlewareOptions) {
  const {
    emailFields = ['body.email'],
    blockDisposable = true,
    errorMessage = 'Disposable email addresses are not allowed.',
    errorStatusCode = 422,
    ...validatorOptions
  } = options ?? {};

  const validator = new EmailValidator(validatorOptions);

  return (
    req: Record<string, unknown> & EmailValidationRequest,
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: (err?: unknown) => void,
  ) => {
    const results: ValidationResult[] = [];

    for (const field of emailFields) {
      const value = getNestedValue(req, field);
      if (typeof value === 'string' && value.length > 0) {
        results.push(validator.check(value));
      }
    }

    // Attach results to the request
    req.emailValidation = results;

    // Block if any disposable email found and blocking is enabled
    if (blockDisposable && results.some((r) => r.disposable)) {
      const disposableResult = results.find((r) => r.disposable)!;
      res.status(errorStatusCode).json({
        error: errorMessage,
        detail: {
          email: disposableResult.email,
          domain: disposableResult.domain,
          reason: disposableResult.reason,
        },
      });
      return;
    }

    next();
  };
}
