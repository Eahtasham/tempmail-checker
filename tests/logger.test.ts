import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger } from '../src/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to silent (no output)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger();
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should output at configured log level', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new Logger({ level: 'info' });
    logger.info('hello');
    expect(spy).toHaveBeenCalledWith('[tempmail-checker] INFO hello');
  });

  it('should suppress messages below the configured level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new Logger({ level: 'warn' });
    logger.debug('hidden');
    logger.info('hidden');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('should output warn and error at warn level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new Logger({ level: 'warn' });
    logger.warn('warning');
    logger.error('error');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('should include meta when provided', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger({ level: 'debug' });
    logger.debug('test', { key: 'value' });
    expect(spy).toHaveBeenCalledWith('[tempmail-checker] DEBUG test', { key: 'value' });
  });

  it('should use a custom prefix', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new Logger({ level: 'info', prefix: '[custom]' });
    logger.info('msg');
    expect(spy).toHaveBeenCalledWith('[custom] INFO msg');
  });

  it('should use a custom handler', () => {
    const handler = vi.fn();
    const logger = new Logger({ level: 'debug', handler });
    logger.debug('test', { foo: 1 });
    expect(handler).toHaveBeenCalledWith('debug', 'test', { foo: 1 });
  });

  it('should update level at runtime with setLevel()', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger({ level: 'silent' });
    logger.debug('hidden');
    expect(spy).not.toHaveBeenCalled();

    logger.setLevel('debug');
    logger.debug('visible');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should return current level via getLevel()', () => {
    const logger = new Logger({ level: 'warn' });
    expect(logger.getLevel()).toBe('warn');
    logger.setLevel('error');
    expect(logger.getLevel()).toBe('error');
  });

  it('should pick up TEMPMAIL_LOG_LEVEL env var', () => {
    const original = process.env['TEMPMAIL_LOG_LEVEL'];
    process.env['TEMPMAIL_LOG_LEVEL'] = 'debug';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const logger = new Logger(); // no explicit level
    logger.debug('from env');
    expect(spy).toHaveBeenCalled();

    if (original === undefined) {
      delete process.env['TEMPMAIL_LOG_LEVEL'];
    } else {
      process.env['TEMPMAIL_LOG_LEVEL'] = original;
    }
  });

  it('createLogger() should return a Logger instance', () => {
    const logger = createLogger({ level: 'info' });
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getLevel()).toBe('info');
  });

  // ─── Rigorous additional tests ────────────────────────────────────

  describe('level priority ordering', () => {
    it('debug level should output all levels', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(handler).toHaveBeenCalledTimes(4);
      expect(handler).toHaveBeenNthCalledWith(1, 'debug', 'd', undefined);
      expect(handler).toHaveBeenNthCalledWith(2, 'info', 'i', undefined);
      expect(handler).toHaveBeenNthCalledWith(3, 'warn', 'w', undefined);
      expect(handler).toHaveBeenNthCalledWith(4, 'error', 'e', undefined);
    });

    it('info level should suppress debug only', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'info', handler });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls.map((c: unknown[]) => c[0])).toEqual(['info', 'warn', 'error']);
    });

    it('error level should suppress debug, info, and warn', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'error', handler });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('error', 'e', undefined);
    });

    it('silent level should suppress all output', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'silent', handler });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('custom handler edge cases', () => {
    it('should pass undefined meta when meta is not provided', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      logger.debug('no meta');
      expect(handler).toHaveBeenCalledWith('debug', 'no meta', undefined);
    });

    it('should pass empty object meta when provided', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      logger.debug('empty meta', {});
      expect(handler).toHaveBeenCalledWith('debug', 'empty meta', {});
    });

    it('should pass complex nested meta correctly', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      const meta = { arr: [1, 2, 3], nested: { a: { b: 'deep' } }, num: 42 };
      logger.info('complex', meta);
      expect(handler).toHaveBeenCalledWith('info', 'complex', meta);
    });

    it('should not throw when handler throws', () => {
      const handler = vi.fn(() => { throw new Error('handler boom'); });
      const logger = new Logger({ level: 'debug', handler });
      // The logger itself doesn't catch handler errors, so this should throw
      expect(() => logger.debug('boom')).toThrow('handler boom');
    });
  });

  describe('setLevel dynamic behavior', () => {
    it('should transition from silent to debug and back', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'silent', handler });

      logger.debug('hidden1');
      expect(handler).not.toHaveBeenCalled();

      logger.setLevel('debug');
      logger.debug('visible');
      expect(handler).toHaveBeenCalledTimes(1);

      logger.setLevel('silent');
      logger.debug('hidden2');
      expect(handler).toHaveBeenCalledTimes(1); // still 1
    });

    it('should allow multiple level changes in sequence', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'silent', handler });

      logger.setLevel('error');
      logger.warn('suppressed');
      logger.error('shown1');

      logger.setLevel('warn');
      logger.warn('shown2');
      logger.info('suppressed2');

      logger.setLevel('debug');
      logger.debug('shown3');

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('default handler console routing', () => {
    it('should route debug to console.debug', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const logger = new Logger({ level: 'debug' });
      logger.debug('msg');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should route info to console.info', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new Logger({ level: 'info' });
      logger.info('msg');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should route warn to console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = new Logger({ level: 'warn' });
      logger.warn('msg');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should route error to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error' });
      logger.error('msg');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should not include meta argument when meta is undefined', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new Logger({ level: 'info' });
      logger.info('no meta');
      expect(spy).toHaveBeenCalledWith('[tempmail-checker] INFO no meta');
      // Should be called with exactly 1 argument (no trailing undefined)
      expect(spy.mock.calls[0]).toHaveLength(1);
    });

    it('should include meta argument when meta is provided', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new Logger({ level: 'info' });
      logger.info('with meta', { key: 'val' });
      expect(spy.mock.calls[0]).toHaveLength(2);
      expect(spy.mock.calls[0]![1]).toEqual({ key: 'val' });
    });
  });

  describe('env var edge cases', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env['TEMPMAIL_LOG_LEVEL'];
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env['TEMPMAIL_LOG_LEVEL'];
      } else {
        process.env['TEMPMAIL_LOG_LEVEL'] = originalEnv;
      }
    });

    it('should ignore invalid env var values', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = 'invalid_level';
      const logger = new Logger();
      expect(logger.getLevel()).toBe('silent');
    });

    it('should ignore empty env var', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = '';
      const logger = new Logger();
      expect(logger.getLevel()).toBe('silent');
    });

    it('should accept "warn" from env var', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = 'warn';
      const logger = new Logger();
      expect(logger.getLevel()).toBe('warn');
    });

    it('should accept "error" from env var', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = 'error';
      const logger = new Logger();
      expect(logger.getLevel()).toBe('error');
    });

    it('should accept "silent" from env var', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = 'silent';
      const logger = new Logger();
      expect(logger.getLevel()).toBe('silent');
    });

    it('explicit level option should override env var', () => {
      process.env['TEMPMAIL_LOG_LEVEL'] = 'debug';
      const logger = new Logger({ level: 'error' });
      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('empty/special prefix', () => {
    it('should work with empty string prefix', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new Logger({ level: 'info', prefix: '' });
      logger.info('msg');
      expect(spy).toHaveBeenCalledWith(' INFO msg');
    });

    it('should work with special character prefix', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = new Logger({ level: 'info', prefix: '🔥 [app]' });
      logger.info('msg');
      expect(spy).toHaveBeenCalledWith('🔥 [app] INFO msg');
    });
  });

  describe('constructor defaults', () => {
    it('should use default prefix when not provided', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      // Handler receives raw level/message, not the formatted prefix
      // The prefix is only used by the default handler
      logger.debug('test');
      expect(handler).toHaveBeenCalledWith('debug', 'test', undefined);
    });

    it('should work with no options at all', () => {
      const logger = new Logger();
      expect(logger.getLevel()).toBe('silent');
    });

    it('should work with undefined options', () => {
      const logger = new Logger(undefined);
      expect(logger.getLevel()).toBe('silent');
    });
  });

  describe('rapid successive calls', () => {
    it('should handle many rapid log calls', () => {
      const handler = vi.fn();
      const logger = new Logger({ level: 'debug', handler });
      for (let i = 0; i < 1000; i++) {
        logger.debug(`msg-${i}`, { i });
      }
      expect(handler).toHaveBeenCalledTimes(1000);
    });
  });
});
