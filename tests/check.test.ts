import { describe, it, expect } from 'vitest';
import { isDisposable, isTemp } from '../src/check';

describe('Functional API', () => {
  describe('isDisposable()', () => {
    it('should return ValidationResult for disposable email', () => {
      const result = isDisposable('user@mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.email).toBe('user@mailinator.com');
      expect(result.domain).toBe('mailinator.com');
      expect(result.reason).toBe('blocklist');
    });

    it('should return ValidationResult for legitimate email', () => {
      const result = isDisposable('user@gmail.com');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return ValidationResult for invalid email', () => {
      const result = isDisposable('not-an-email');
      expect(result.disposable).toBe(false);
      expect(result.reason).toBe('invalid_email');
    });

    it('should detect subdomain disposable emails', () => {
      const result = isDisposable('user@sub.mailinator.com');
      expect(result.disposable).toBe(true);
      expect(result.reason).toBe('subdomain_match');
    });
  });

  describe('isTemp()', () => {
    it('should return true for disposable email', () => {
      expect(isTemp('user@mailinator.com')).toBe(true);
    });

    it('should return false for legitimate email', () => {
      expect(isTemp('user@gmail.com')).toBe(false);
    });

    it('should return false for invalid email', () => {
      expect(isTemp('not-an-email')).toBe(false);
    });

    it('should return true for guerrillamail.com', () => {
      expect(isTemp('test@guerrillamail.com')).toBe(true);
    });

    it('should return true for yopmail.com', () => {
      expect(isTemp('anything@yopmail.com')).toBe(true);
    });

    it('should return false for hotmail.com', () => {
      expect(isTemp('user@hotmail.com')).toBe(false);
    });
  });
});
