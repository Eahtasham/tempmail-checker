import { EmailValidator } from '../validator';
import type { ValidationResult, ValidatorOptions } from '../types';

/**
 * Options for the Fastify plugin.
 */
export interface FastifyPluginOptions extends ValidatorOptions {
  /**
   * Which request field(s) to extract the email from.
   * Supports dot notation for nested fields (e.g. 'body.email', 'query.email').
   * Default: ['body.email']
   */
  emailFields?: string[];

  /**
   * If true, block the request with 422 when a disposable email is detected.
   * If false, decorate the request with validation results and continue.
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
 * Resolve a dot-notation path on an object.
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
 * Minimal Fastify instance interface for plugin registration.
 */
interface FastifyInstance {
  decorateRequest: (name: string, value: unknown) => void;
  addHook: (hook: string, handler: (req: FastifyRequest, reply: FastifyReply, done: () => void) => void) => void;
}

interface FastifyRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  emailValidation?: ValidationResult[];
  [key: string]: unknown;
}

interface FastifyReply {
  status: (code: number) => FastifyReply;
  send: (body: unknown) => void;
}

/**
 * Fastify plugin that validates emails in incoming requests.
 *
 * Register as a Fastify plugin — it decorates requests with `emailValidation`
 * results and optionally blocks disposable emails.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { fastifyTempmail } from 'tempmail-checker/middleware/fastify';
 *
 * const app = Fastify();
 *
 * app.register(fastifyTempmail, {
 *   emailFields: ['body.email'],
 *   blockDisposable: true,
 * });
 *
 * app.post('/register', async (req, reply) => {
 *   // If we reach here, email is not disposable
 *   return { ok: true };
 * });
 * ```
 */
export function fastifyTempmail(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  const {
    emailFields = ['body.email'],
    blockDisposable = true,
    errorMessage = 'Disposable email addresses are not allowed.',
    errorStatusCode = 422,
    ...validatorOptions
  } = options ?? {};

  const validator = new EmailValidator(validatorOptions);

  // Decorate request with emailValidation property
  fastify.decorateRequest('emailValidation', null);

  fastify.addHook('preHandler', (req: FastifyRequest, reply: FastifyReply, hookDone: () => void) => {
    const results: ValidationResult[] = [];

    for (const field of emailFields) {
      const value = getNestedValue(req as unknown as Record<string, unknown>, field);
      if (typeof value === 'string' && value.length > 0) {
        results.push(validator.check(value));
      }
    }

    req.emailValidation = results;

    if (blockDisposable && results.some((r) => r.disposable)) {
      const disposableResult = results.find((r) => r.disposable)!;
      reply.status(errorStatusCode).send({
        error: errorMessage,
        detail: {
          email: disposableResult.email,
          domain: disposableResult.domain,
          reason: disposableResult.reason,
        },
      });
      return;
    }

    hookDone();
  });

  done();
}
