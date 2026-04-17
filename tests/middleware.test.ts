import { describe, it, expect, vi } from 'vitest';
import { createExpressMiddleware } from '../src/middleware/express';
import { fastifyTempmail } from '../src/middleware/fastify';

// ─── Express Middleware ─────────────────────────────────────────────

describe('createExpressMiddleware', () => {
  function mockRes() {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    return { status, json };
  }

  it('should block disposable emails with default settings', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Disposable email addresses are not allowed.',
      }),
    );
  });

  it('should allow non-disposable emails', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: 'user@gmail.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should attach results when blockDisposable=false', () => {
    const mw = createExpressMiddleware({ blockDisposable: false });
    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.emailValidation).toBeDefined();
    expect(Array.isArray(req.emailValidation)).toBe(true);
    expect((req.emailValidation as unknown[])[0]).toMatchObject({ disposable: true });
  });

  it('should use custom emailFields', () => {
    const mw = createExpressMiddleware({ emailFields: ['query.email'] });
    const req = { query: { email: 'user@mailinator.com' }, body: {} } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should use custom error message and status code', () => {
    const mw = createExpressMiddleware({
      errorMessage: 'Nope!',
      errorStatusCode: 400,
    });
    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Nope!' }),
    );
  });

  it('should skip validation when no email is present', () => {
    const mw = createExpressMiddleware();
    const req = { body: {} } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  // ─── Rigorous additional Express tests ─────────────────────────────

  it('should handle multiple emailFields simultaneously', () => {
    const mw = createExpressMiddleware({
      emailFields: ['body.email', 'body.secondaryEmail'],
      blockDisposable: false,
    });
    const req = {
      body: { email: 'user@gmail.com', secondaryEmail: 'user@mailinator.com' },
    } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    const results = req.emailValidation as Array<{ disposable: boolean }>;
    expect(results).toHaveLength(2);
    expect(results[0]!.disposable).toBe(false);
    expect(results[1]!.disposable).toBe(true);
  });

  it('should block if any of multiple emailFields is disposable', () => {
    const mw = createExpressMiddleware({
      emailFields: ['body.email', 'body.backup'],
    });
    const req = {
      body: { email: 'user@gmail.com', backup: 'user@guerrillamail.com' },
    } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should handle deeply nested emailFields', () => {
    const mw = createExpressMiddleware({
      emailFields: ['body.user.contact.email'],
    });
    const req = {
      body: { user: { contact: { email: 'user@mailinator.com' } } },
    } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should gracefully handle missing nested path', () => {
    const mw = createExpressMiddleware({
      emailFields: ['body.user.contact.email'],
    });
    const req = { body: { user: {} } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should ignore non-string email values', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: 12345 } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should ignore null email values', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: null } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should ignore empty string email values', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: '' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle undefined body gracefully', () => {
    const mw = createExpressMiddleware();
    const req = {} as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should respect customAllowlist in middleware options', () => {
    const mw = createExpressMiddleware({
      customAllowlist: ['mailinator.com'],
    });
    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should respect customBlocklist in middleware options', () => {
    const mw = createExpressMiddleware({
      customBlocklist: ['my-custom-bad.com'],
    });
    const req = { body: { email: 'user@my-custom-bad.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should include detail in blocked response', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          email: 'user@mailinator.com',
          domain: 'mailinator.com',
          reason: expect.any(String),
        }),
      }),
    );
  });

  it('should detect subdomain disposable emails', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: 'user@sub.yopmail.com' } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should always attach emailValidation array even when empty', () => {
    const mw = createExpressMiddleware({ blockDisposable: false });
    const req = { body: {} } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    expect(req.emailValidation).toBeDefined();
    expect(req.emailValidation).toEqual([]);
  });

  it('should handle array email field values gracefully (not crash)', () => {
    const mw = createExpressMiddleware();
    const req = { body: { email: ['a@b.com', 'c@d.com'] } } as Record<string, unknown>;
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next);

    // Array is not a string, so it should be skipped
    expect(next).toHaveBeenCalled();
  });
});

// ─── Fastify Plugin ─────────────────────────────────────────────────

describe('fastifyTempmail', () => {
  function createMockFastify() {
    const decorateRequest = vi.fn();
    let hookFn: Function | undefined;
    const addHook = vi.fn((_hook: string, fn: Function) => { hookFn = fn; });
    return { decorateRequest, addHook, getHook: () => hookFn };
  }

  function createMockReply() {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    return { status, send };
  }

  it('should register plugin and add preHandler hook', () => {
    const decorateRequest = vi.fn();
    const addHook = vi.fn();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, {}, done);

    expect(decorateRequest).toHaveBeenCalledWith('emailValidation', null);
    expect(addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));
    expect(done).toHaveBeenCalled();
  });

  it('should block disposable emails in preHandler', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, { emailFields: ['body.email'] }, done);

    const req = { body: { email: 'user@mailinator.com' } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(hookDone).not.toHaveBeenCalled();
  });

  it('should allow non-disposable emails in preHandler', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, { emailFields: ['body.email'] }, done);

    const req = { body: { email: 'user@gmail.com' } } as Record<string, unknown>;
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(hookDone).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
    expect(req.emailValidation).toBeDefined();
  });

  // ─── Rigorous additional Fastify tests ─────────────────────────────

  it('should use default emailFields when not specified', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, {}, done);

    const req = { body: { email: 'user@mailinator.com' } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(reply.status).toHaveBeenCalledWith(422);
  });

  it('should attach results and not block when blockDisposable=false', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, { blockDisposable: false, emailFields: ['body.email'] }, done);

    const req = { body: { email: 'user@mailinator.com' } } as Record<string, unknown>;
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(hookDone).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
    const results = req.emailValidation as Array<{ disposable: boolean }>;
    expect(results).toHaveLength(1);
    expect(results[0]!.disposable).toBe(true);
  });

  it('should use custom error message and status code', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail(
      { decorateRequest, addHook },
      { errorMessage: 'Bad!', errorStatusCode: 403, emailFields: ['body.email'] },
      done,
    );

    const req = { body: { email: 'user@mailinator.com' } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Bad!' }),
    );
  });

  it('should handle missing body gracefully', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, { emailFields: ['body.email'] }, done);

    const req = {} as Record<string, unknown>;
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(hookDone).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('should handle deeply nested fields', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail(
      { decorateRequest, addHook },
      { emailFields: ['body.data.user.email'] },
      done,
    );

    const req = { body: { data: { user: { email: 'user@guerrillamail.com' } } } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(reply.status).toHaveBeenCalledWith(422);
  });

  it('should respect customAllowlist in options', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail(
      { decorateRequest, addHook },
      { customAllowlist: ['mailinator.com'], emailFields: ['body.email'] },
      done,
    );

    const req = { body: { email: 'user@mailinator.com' } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(hookDone).toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('should detect subdomain disposable emails', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail({ decorateRequest, addHook }, { emailFields: ['body.email'] }, done);

    const req = { body: { email: 'user@sub.yopmail.com' } };
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(hookDone).not.toHaveBeenCalled();
  });

  it('should check multiple email fields', () => {
    const { decorateRequest, addHook, getHook } = createMockFastify();
    const done = vi.fn();

    fastifyTempmail(
      { decorateRequest, addHook },
      { emailFields: ['body.email', 'query.email'], blockDisposable: false },
      done,
    );

    const req = {
      body: { email: 'user@gmail.com' },
      query: { email: 'user@yopmail.com' },
    } as Record<string, unknown>;
    const reply = createMockReply();
    const hookDone = vi.fn();

    getHook()!(req, reply, hookDone);

    expect(hookDone).toHaveBeenCalled();
    const results = req.emailValidation as Array<{ disposable: boolean }>;
    expect(results).toHaveLength(2);
    expect(results[0]!.disposable).toBe(false);
    expect(results[1]!.disposable).toBe(true);
  });
});
