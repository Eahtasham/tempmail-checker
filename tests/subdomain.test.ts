import { describe, it, expect } from 'vitest';
import { getDomainLevels } from '../src/subdomain';

describe('getDomainLevels', () => {
  it('should return single level for a registrable domain', () => {
    const levels = getDomainLevels('tempmail.com');
    expect(levels).toEqual(['tempmail.com']);
  });

  it('should return multiple levels for subdomains', () => {
    const levels = getDomainLevels('mail.tempmail.com');
    expect(levels).toEqual(['mail.tempmail.com', 'tempmail.com']);
  });

  it('should handle deep subdomains', () => {
    const levels = getDomainLevels('a.b.tempmail.com');
    expect(levels).toEqual(['a.b.tempmail.com', 'b.tempmail.com', 'tempmail.com']);
  });

  it('should handle multi-part TLDs (co.uk)', () => {
    const levels = getDomainLevels('sub.example.co.uk');
    expect(levels).toEqual(['sub.example.co.uk', 'example.co.uk']);
  });

  it('should not generate bare TLD levels', () => {
    const levels = getDomainLevels('mail.tempmail.com');
    expect(levels).not.toContain('com');
  });

  it('should not generate multi-part TLD levels', () => {
    const levels = getDomainLevels('sub.example.co.uk');
    expect(levels).not.toContain('co.uk');
    expect(levels).not.toContain('uk');
  });

  it('should handle registrable domain only (no subdomain)', () => {
    const levels = getDomainLevels('example.co.uk');
    expect(levels).toEqual(['example.co.uk']);
  });

  it('should lowercase the domain', () => {
    const levels = getDomainLevels('MAIL.TEMPMAIL.COM');
    expect(levels).toEqual(['mail.tempmail.com', 'tempmail.com']);
  });

  it('should handle empty string', () => {
    const levels = getDomainLevels('');
    expect(levels).toEqual([]);
  });

  it('should handle domain without dots', () => {
    const levels = getDomainLevels('localhost');
    expect(levels).toEqual(['localhost']);
  });

  it('should trim whitespace', () => {
    const levels = getDomainLevels('  mail.tempmail.com  ');
    expect(levels).toEqual(['mail.tempmail.com', 'tempmail.com']);
  });

  it('should handle .com.au TLD', () => {
    const levels = getDomainLevels('sub.example.com.au');
    expect(levels).toEqual(['sub.example.com.au', 'example.com.au']);
  });

  it('should handle .org.uk TLD', () => {
    const levels = getDomainLevels('example.org.uk');
    expect(levels).toEqual(['example.org.uk']);
  });

  it('should return levels in most-specific-first order', () => {
    const levels = getDomainLevels('a.b.c.example.com');
    expect(levels[0]).toBe('a.b.c.example.com');
    expect(levels[levels.length - 1]).toBe('example.com');
  });
});
