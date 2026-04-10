import { describe, it, expect, afterEach } from 'vitest';
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
});
