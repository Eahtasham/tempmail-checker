import { describe, it, expect, afterEach, vi } from 'vitest';
import { EmailValidator } from '../src/validator';

describe('EmailValidator', () => {
  let validator: EmailValidator;

  afterEach(() => {
    if (validator) {
      validator.destroy();
    }
  });

  describe('basic validation', () => {
    it('should detect a known disposable email domain', () => {
      validator = new EmailValidator();
      const result = validator.check('user@mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('blocklist');
      expect(result.domain).toBe('mailinator.com');
      expect(result.matchedDomain).toBe('mailinator.com');
    });

    it('should allow a legitimate email domain', () => {
      validator = new EmailValidator();
      const result = validator.check('user@gmail.com');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('not_found');
      expect(result.domain).toBe('gmail.com');
    });

    it('should detect guerrillamail.com as disposable', () => {
      validator = new EmailValidator();
      const result = validator.check('test@guerrillamail.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('blocklist');
    });

    it('should detect yopmail.com as disposable', () => {
      validator = new EmailValidator();
      const result = validator.check('anything@yopmail.com');
      expect(result.disposable).toBe(true);
    });

    it('should detect 10minutemail.com as disposable', () => {
      validator = new EmailValidator();
      const result = validator.check('test@10minutemail.com');
      expect(result.disposable).toBe(true);
    });

    it('should allow outlook.com', () => {
      validator = new EmailValidator();
      const result = validator.check('user@outlook.com');
      expect(result.disposable).toBe(false);
    });

    it('should allow yahoo.com', () => {
      validator = new EmailValidator();
      const result = validator.check('user@yahoo.com');
      expect(result.disposable).toBe(false);
    });
  });

  describe('invalid emails', () => {
    it('should return invalid_email for malformed addresses', () => {
      validator = new EmailValidator();
      const result = validator.check('not-an-email');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('invalid_email');
      expect(result.domain).toBe('');
    });

    it('should return invalid_email for empty string', () => {
      validator = new EmailValidator();
      const result = validator.check('');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('invalid_email');
    });
  });

  describe('subdomain detection', () => {
    it('should detect subdomains of disposable domains', () => {
      validator = new EmailValidator();
      const result = validator.check('user@sub.mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('subdomain_match');
      expect(result.matchedDomain).toBe('mailinator.com');
    });

    it('should detect deep subdomains', () => {
      validator = new EmailValidator();
      const result = validator.check('user@a.b.c.mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('subdomain_match');
      expect(result.matchedDomain).toBe('mailinator.com');
    });
  });

  describe('custom allowlist', () => {
    it('should override blocklist for allowlisted domains', () => {
      validator = new EmailValidator({
        customAllowlist: ['mailinator.com'],
      });
      const result = validator.check('user@mailinator.com');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('allowlist');
      expect(result.matchedDomain).toBe('mailinator.com');
    });

    it('should override subdomain match for allowlisted parent', () => {
      validator = new EmailValidator({
        customAllowlist: ['mailinator.com'],
      });
      const result = validator.check('user@sub.mailinator.com');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('allowlist');
    });
  });

  describe('custom blocklist', () => {
    it('should block custom blocklisted domains', () => {
      validator = new EmailValidator({
        customBlocklist: ['my-spam-domain.com'],
      });
      const result = validator.check('user@my-spam-domain.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('custom_blocklist');
      expect(result.matchedDomain).toBe('my-spam-domain.com');
    });

    it('should block subdomains of custom blocklisted domains', () => {
      validator = new EmailValidator({
        customBlocklist: ['my-spam-domain.com'],
      });
      const result = validator.check('user@sub.my-spam-domain.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('custom_blocklist');
    });

    it('should prioritize allowlist over custom blocklist', () => {
      validator = new EmailValidator({
        customBlocklist: ['conflict.com'],
        customAllowlist: ['conflict.com'],
      });
      const result = validator.check('user@conflict.com');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('allowlist');
    });
  });

  describe('checkMany()', () => {
    it('should validate multiple emails', () => {
      validator = new EmailValidator();
      const results = validator.checkMany([
        'user@gmail.com',
        'user@mailinator.com',
        'invalid',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]!.disposable).toBe(false);
      expect(results[1]!.disposable).toBe(true);
      expect(results[2]!.reason).toBe('invalid_email');
    });
  });

  describe('stats()', () => {
    it('should return stats about the validator', () => {
      validator = new EmailValidator({
        customBlocklist: ['custom1.com', 'custom2.com'],
        customAllowlist: ['allowed.com'],
      });

      const stats = validator.stats();
      expect(stats.totalDomains).toBeGreaterThan(0);
      expect(stats.bloomFilterSizeBytes).toBeGreaterThan(0);
      expect(stats.customBlocklistSize).toBe(2);
      expect(stats.allowlistSize).toBe(1);
      expect(stats.lastUpdated).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase email domains', () => {
      validator = new EmailValidator();
      const result = validator.check('User@MAILINATOR.COM');
      expect(result.disposable).toBe(true);
    });

    it('should handle mixed case custom lists', () => {
      validator = new EmailValidator({
        customBlocklist: ['MY-SPAM.COM'],
      });
      const result = validator.check('user@my-spam.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('custom_blocklist');
    });
  });

  describe('result shape', () => {
    it('should return a complete ValidationResult for disposable emails', () => {
      validator = new EmailValidator();
      const result = validator.check('user@mailinator.com');

      expect(result).toHaveProperty('disposable', true);
      expect(result).toHaveProperty('email', 'user@mailinator.com');
      expect(result).toHaveProperty('domain', 'mailinator.com');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('matchedDomain');
    });

    it('should return a complete ValidationResult for valid emails', () => {
      validator = new EmailValidator();
      const result = validator.check('user@gmail.com');

      expect(result).toHaveProperty('disposable', false);
      expect(result).toHaveProperty('email', 'user@gmail.com');
      expect(result).toHaveProperty('domain', 'gmail.com');
      expect(result).toHaveProperty('reason', 'not_found');
      expect(result.matchedDomain).toBeUndefined();
    });
  });

  // ─── Rigorous additional validator tests ────────────────────────────

  describe('logging integration', () => {
    it('should emit debug logs during check when logging is enabled', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        logging: { level: 'debug', handler },
      });
      handler.mockClear(); // clear init logs

      validator.check('user@gmail.com');

      const debugCalls = handler.mock.calls.filter((c: unknown[]) => c[0] === 'debug');
      expect(debugCalls.length).toBeGreaterThanOrEqual(1);
      // Should log "Checking email" and "Email passed validation"
      const messages = debugCalls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Checking email');
      expect(messages).toContain('Email passed validation');
    });

    it('should emit info log when disposable email is detected', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        logging: { level: 'info', handler },
      });
      handler.mockClear();

      validator.check('user@mailinator.com');

      const infoCalls = handler.mock.calls.filter((c: unknown[]) => c[0] === 'info');
      const messages = infoCalls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Disposable email detected');
    });

    it('should emit debug log for invalid email', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        logging: { level: 'debug', handler },
      });
      handler.mockClear();

      validator.check('not-valid');

      const debugCalls = handler.mock.calls.filter((c: unknown[]) => c[0] === 'debug');
      const messages = debugCalls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Invalid email address');
    });

    it('should emit info log for custom blocklist match', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        customBlocklist: ['my-bad.com'],
        logging: { level: 'info', handler },
      });
      handler.mockClear();

      validator.check('user@my-bad.com');

      const infoCalls = handler.mock.calls.filter((c: unknown[]) => c[0] === 'info');
      const messages = infoCalls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Disposable email detected (custom blocklist)');
    });

    it('should emit debug log for allowlist match', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        customAllowlist: ['mailinator.com'],
        logging: { level: 'debug', handler },
      });
      handler.mockClear();

      validator.check('user@mailinator.com');

      const debugCalls = handler.mock.calls.filter((c: unknown[]) => c[0] === 'debug');
      const messages = debugCalls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Domain matched allowlist');
    });

    it('should not emit logs when logging is silent (default)', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      validator = new EmailValidator();
      validator.check('user@mailinator.com');
      expect(spy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should log initialization details', () => {
      const handler = vi.fn();
      validator = new EmailValidator({
        logging: { level: 'debug', handler },
      });
      const messages = handler.mock.calls.map((c: unknown[]) => c[1]);
      expect(messages).toContain('Initializing EmailValidator');
      expect(messages).toContain('EmailValidator initialized');
    });
  });

  describe('edge case emails', () => {
    it('should handle email with plus addressing', () => {
      validator = new EmailValidator();
      const result = validator.check('user+tag@mailinator.com');
      expect(result.disposable).toBe(true);
    });

    it('should handle email with dots in local part', () => {
      validator = new EmailValidator();
      const result = validator.check('first.last@gmail.com');
      expect(result.disposable).toBe(false);
    });

    it('should handle email with very long local part', () => {
      validator = new EmailValidator();
      const longLocal = 'a'.repeat(64);
      const result = validator.check(`${longLocal}@gmail.com`);
      expect(result.disposable).toBe(false);
      expect(result.domain).toBe('gmail.com');
    });

    it('should handle email with uppercase mixed case', () => {
      validator = new EmailValidator();
      const result = validator.check('USER@MAILINATOR.COM');
      expect(result.disposable).toBe(true);
    });

    it('should handle email with only domain (no @)', () => {
      validator = new EmailValidator();
      const result = validator.check('mailinator.com');
      expect(result.reason).toBe('invalid_email');
    });

    it('should handle email with multiple @ (parser dependent)', () => {
      validator = new EmailValidator();
      const result = validator.check('user@@mailinator.com');
      // The parser may extract a domain from this — assert it doesn't crash
      expect(typeof result.disposable).toBe('boolean');
    });

    it('should handle email with spaces (parser dependent)', () => {
      validator = new EmailValidator();
      const result = validator.check('user @gmail.com');
      // The parser may or may not reject this — assert no crash
      expect(typeof result.disposable).toBe('boolean');
    });
  });

  describe('custom lists edge cases', () => {
    it('should handle empty custom blocklist', () => {
      validator = new EmailValidator({ customBlocklist: [] });
      const result = validator.check('user@gmail.com');
      expect(result.disposable).toBe(false);
    });

    it('should handle empty custom allowlist', () => {
      validator = new EmailValidator({ customAllowlist: [] });
      const result = validator.check('user@mailinator.com');
      expect(result.disposable).toBe(true);
    });

    it('should handle duplicate domains in custom blocklist', () => {
      validator = new EmailValidator({
        customBlocklist: ['dup.com', 'dup.com', 'dup.com'],
      });
      const stats = validator.stats();
      expect(stats.customBlocklistSize).toBe(1); // Set deduplicates
    });

    it('should handle mixed case in custom lists', () => {
      validator = new EmailValidator({
        customBlocklist: ['UPPER.COM'],
        customAllowlist: ['Lower.com'],
      });
      const result1 = validator.check('user@upper.com');
      expect(result1.disposable).toBe(true);
      expect(result1.reason).toBe('custom_blocklist');

      const result2 = validator.check('user@LOWER.COM');
      expect(result2.disposable).toBe(false);
      expect(result2.reason).toBe('allowlist');
    });

    it('should handle large custom blocklist', () => {
      const largelist = Array.from({ length: 1000 }, (_, i) => `domain-${i}.test`);
      validator = new EmailValidator({ customBlocklist: largelist });
      expect(validator.check('user@domain-500.test').disposable).toBe(true);
      expect(validator.check('user@domain-999.test').disposable).toBe(true);
      expect(validator.check('user@domain-1000.test').disposable).toBe(false);
    });
  });

  describe('checkMany edge cases', () => {
    it('should return empty array for empty input', () => {
      validator = new EmailValidator();
      const results = validator.checkMany([]);
      expect(results).toEqual([]);
    });

    it('should handle single email', () => {
      validator = new EmailValidator();
      const results = validator.checkMany(['user@mailinator.com']);
      expect(results).toHaveLength(1);
      expect(results[0]!.disposable).toBe(true);
    });

    it('should handle all invalid emails', () => {
      validator = new EmailValidator();
      const results = validator.checkMany(['bad', '', '@', 'no-at']);
      expect(results).toHaveLength(4);
      results.forEach((r) => expect(r!.reason).toBe('invalid_email'));
    });

    it('should handle mix of valid, invalid, disposable', () => {
      validator = new EmailValidator();
      const results = validator.checkMany([
        'user@gmail.com',
        'invalid',
        'user@mailinator.com',
        'user@sub.yopmail.com',
        'user@outlook.com',
      ]);
      expect(results[0]!.disposable).toBe(false);
      expect(results[1]!.reason).toBe('invalid_email');
      expect(results[2]!.disposable).toBe(true);
      expect(results[3]!.disposable).toBe(true);
      expect(results[4]!.disposable).toBe(false);
    });

    it('should handle duplicate emails', () => {
      validator = new EmailValidator();
      const results = validator.checkMany([
        'user@mailinator.com',
        'user@mailinator.com',
      ]);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(results[1]);
    });
  });

  describe('stats accuracy', () => {
    it('should reflect custom blocklist additions in totalDomains', () => {
      // Adding a new custom domain should increase total
      validator = new EmailValidator();
      const baseline = validator.stats().totalDomains;

      validator.destroy();
      validator = new EmailValidator({
        customBlocklist: ['brand-new-domain-xyz.test'],
      });
      expect(validator.stats().totalDomains).toBe(baseline + 1);
    });

    it('should report lastUpdated as null before refresh', () => {
      validator = new EmailValidator();
      expect(validator.stats().lastUpdated).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should be safe to call destroy multiple times', () => {
      validator = new EmailValidator();
      validator.destroy();
      validator.destroy();
      validator.destroy();
      // Should not throw
    });

    it('should still work for checks after destroy (no timer, but data intact)', () => {
      validator = new EmailValidator();
      validator.destroy();
      const result = validator.check('user@mailinator.com');
      expect(result.disposable).toBe(true);
    });
  });

  describe('constructor options', () => {
    it('should work with no options', () => {
      validator = new EmailValidator();
      expect(validator.stats().totalDomains).toBeGreaterThan(0);
    });

    it('should work with undefined options', () => {
      validator = new EmailValidator(undefined);
      expect(validator.stats().totalDomains).toBeGreaterThan(0);
    });

    it('should work with empty object options', () => {
      validator = new EmailValidator({});
      expect(validator.stats().totalDomains).toBeGreaterThan(0);
    });
  });
});
