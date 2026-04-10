import { describe, it, expect } from 'vitest';
import { parseEmail } from '../src/email-parser';

describe('parseEmail', () => {
  describe('valid emails', () => {
    it('should parse a standard email', () => {
      const result = parseEmail('user@example.com');
      expect(result).toEqual({ local: 'user', domain: 'example.com' });
    });

    it('should lowercase the domain', () => {
      const result = parseEmail('User@EXAMPLE.COM');
      expect(result).toEqual({ local: 'User', domain: 'example.com' });
    });

    it('should trim whitespace', () => {
      const result = parseEmail('  user@example.com  ');
      expect(result).toEqual({ local: 'user', domain: 'example.com' });
    });

    it('should handle subdomains', () => {
      const result = parseEmail('user@mail.example.co.uk');
      expect(result).toEqual({ local: 'user', domain: 'mail.example.co.uk' });
    });

    it('should handle plus addressing', () => {
      const result = parseEmail('user+tag@example.com');
      expect(result).toEqual({ local: 'user+tag', domain: 'example.com' });
    });

    it('should handle dots in local part', () => {
      const result = parseEmail('first.last@example.com');
      expect(result).toEqual({ local: 'first.last', domain: 'example.com' });
    });

    it('should handle hyphens in domain', () => {
      const result = parseEmail('user@my-domain.com');
      expect(result).toEqual({ local: 'user', domain: 'my-domain.com' });
    });

    it('should handle numeric domain labels', () => {
      const result = parseEmail('user@123.com');
      expect(result).toEqual({ local: 'user', domain: '123.com' });
    });
  });

  describe('invalid emails', () => {
    it('should return null for empty string', () => {
      expect(parseEmail('')).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(parseEmail(null as unknown as string)).toBeNull();
      expect(parseEmail(undefined as unknown as string)).toBeNull();
    });

    it('should return null for missing @', () => {
      expect(parseEmail('userexample.com')).toBeNull();
    });

    it('should return null for @ at start', () => {
      expect(parseEmail('@example.com')).toBeNull();
    });

    it('should return null for @ at end', () => {
      expect(parseEmail('user@')).toBeNull();
    });

    it('should return null for domain without dot', () => {
      expect(parseEmail('user@localhost')).toBeNull();
    });

    it('should return null for domain starting with dot', () => {
      expect(parseEmail('user@.example.com')).toBeNull();
    });

    it('should return null for domain ending with dot', () => {
      expect(parseEmail('user@example.com.')).toBeNull();
    });

    it('should return null for domain starting with hyphen', () => {
      expect(parseEmail('user@-example.com')).toBeNull();
    });

    it('should return null for domain ending with hyphen', () => {
      expect(parseEmail('user@example-.com')).toBeNull();
    });

    it('should return null for consecutive dots in domain', () => {
      expect(parseEmail('user@example..com')).toBeNull();
    });

    it('should return null for label starting with hyphen', () => {
      expect(parseEmail('user@ex.-ample.com')).toBeNull();
    });

    it('should return null for overly long local part', () => {
      const longLocal = 'a'.repeat(65);
      expect(parseEmail(`${longLocal}@example.com`)).toBeNull();
    });

    it('should return null for overly long domain', () => {
      const longDomain = 'a'.repeat(254) + '.com';
      expect(parseEmail(`user@${longDomain}`)).toBeNull();
    });

    it('should return null for special characters in domain', () => {
      expect(parseEmail('user@exam ple.com')).toBeNull();
      expect(parseEmail('user@exam_ple.com')).toBeNull();
    });
  });
});
