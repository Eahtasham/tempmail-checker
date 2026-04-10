import { describe, it, expect } from 'vitest';
import { EmailValidator, isDisposable, isTemp, BloomFilter, parseEmail, getDomainLevels } from '../src/index';

describe('Integration Tests', () => {
  describe('full pipeline — known disposable domains', () => {
    const validator = new EmailValidator();

    const disposableDomains = [
      'mailinator.com',
      'guerrillamail.com',
      'yopmail.com',
      'dispostable.com',
      'temp-mail.org',
      'fakeinbox.com',
      'maildrop.cc',
      'trashmail.com',
      '10minutemail.com',
      'sharklasers.com',
    ];

    for (const domain of disposableDomains) {
      it(`should detect ${domain} as disposable`, () => {
        const result = validator.check(`test@${domain}`);
        expect(result.disposable).toBe(true);
        expect(result.domain).toBe(domain);
      });
    }
  });

  describe('full pipeline — known legitimate domains', () => {
    const validator = new EmailValidator();

    const legitimateDomains = [
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'protonmail.com',
      'icloud.com',
      'aol.com',
      'fastmail.com',
      'zoho.com',
    ];

    for (const domain of legitimateDomains) {
      it(`should allow ${domain}`, () => {
        const result = validator.check(`test@${domain}`);
        expect(result.disposable).toBe(false);
        expect(result.reason).toBe('not_found');
      });
    }
  });

  describe('subdomain bypass prevention', () => {
    const validator = new EmailValidator();

    it('should catch mail.mailinator.com', () => {
      const result = validator.check('user@mail.mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.matchedDomain).toBe('mailinator.com');
    });

    it('should catch deeply nested subdomains', () => {
      const result = validator.check('user@x.y.z.guerrillamail.com');
      expect(result.disposable).toBe(true);
      expect(result.matchedDomain).toBe('guerrillamail.com');
    });
  });

  describe('two-tier pipeline correctness', () => {
    it('should use bloom filter as first gate', () => {
      const validator = new EmailValidator();

      // A domain NOT in the disposable list should be rejected at bloom filter level
      // (bloom says "definitely not") and never reach the hash set
      const result = validator.check('user@google.com');
      expect(result.disposable).toBe(false);
    });

    it('should use hash set to confirm bloom filter positives', () => {
      const validator = new EmailValidator();

      // A known disposable domain should pass bloom filter ("maybe") and be confirmed by hash set
      const result = validator.check('user@mailinator.com');
      expect(result.disposable).toBe(true);
    });
  });

  describe('custom lists integration', () => {
    it('should support full workflow with custom lists', () => {
      const validator = new EmailValidator({
        customBlocklist: ['internal-spam.example.com'],
        customAllowlist: ['mailinator.com'], // Override known disposable
      });

      // Custom allowlist overrides built-in blocklist
      expect(validator.check('user@mailinator.com').disposable).toBe(false);

      // Custom blocklist works
      expect(validator.check('user@internal-spam.example.com').disposable).toBe(true);

      // Other disposable domains still detected
      expect(validator.check('user@guerrillamail.com').disposable).toBe(true);

      // Normal domains still allowed
      expect(validator.check('user@gmail.com').disposable).toBe(false);

      validator.destroy();
    });
  });

  describe('exports', () => {
    it('should export EmailValidator class', () => {
      expect(EmailValidator).toBeDefined();
      expect(typeof EmailValidator).toBe('function');
    });

    it('should export isDisposable function', () => {
      expect(isDisposable).toBeDefined();
      expect(typeof isDisposable).toBe('function');
    });

    it('should export isTemp function', () => {
      expect(isTemp).toBeDefined();
      expect(typeof isTemp).toBe('function');
    });

    it('should export BloomFilter class', () => {
      expect(BloomFilter).toBeDefined();
      expect(typeof BloomFilter).toBe('function');
    });

    it('should export parseEmail function', () => {
      expect(parseEmail).toBeDefined();
      expect(typeof parseEmail).toBe('function');
    });

    it('should export getDomainLevels function', () => {
      expect(getDomainLevels).toBeDefined();
      expect(typeof getDomainLevels).toBe('function');
    });
  });

  describe('performance sanity check', () => {
    it('should validate 10,000 emails in under 500ms', () => {
      const validator = new EmailValidator();
      const emails: string[] = [];

      for (let i = 0; i < 10000; i++) {
        emails.push(`user${i}@domain${i % 100}.com`);
      }

      const start = performance.now();
      for (const email of emails) {
        validator.check(email);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      validator.destroy();
    });
  });
});
