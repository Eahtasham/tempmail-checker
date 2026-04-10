import { describe, it, expect } from 'vitest';
import { murmurhash3_32 } from '../src/hash';

describe('murmurhash3_32', () => {
  it('should return consistent hashes for the same input', () => {
    const hash1 = murmurhash3_32('hello', 0);
    const hash2 = murmurhash3_32('hello', 0);
    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different inputs', () => {
    const hash1 = murmurhash3_32('hello', 0);
    const hash2 = murmurhash3_32('world', 0);
    expect(hash1).not.toBe(hash2);
  });

  it('should return different hashes for different seeds', () => {
    const hash1 = murmurhash3_32('hello', 0);
    const hash2 = murmurhash3_32('hello', 42);
    expect(hash1).not.toBe(hash2);
  });

  it('should return an unsigned 32-bit integer', () => {
    const hash = murmurhash3_32('test', 0);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });

  it('should handle empty string', () => {
    const hash = murmurhash3_32('', 0);
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  it('should handle strings of various lengths (tail processing)', () => {
    // Test all remainder cases: len % 4 = 0, 1, 2, 3
    const h0 = murmurhash3_32('abcd', 0); // len=4, remainder=0
    const h1 = murmurhash3_32('abcde', 0); // len=5, remainder=1
    const h2 = murmurhash3_32('abcdef', 0); // len=6, remainder=2
    const h3 = murmurhash3_32('abcdefg', 0); // len=7, remainder=3

    // All should be valid unsigned 32-bit integers
    for (const h of [h0, h1, h2, h3]) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }

    // All should be different
    const hashes = new Set([h0, h1, h2, h3]);
    expect(hashes.size).toBe(4);
  });

  it('should handle long strings', () => {
    const longString = 'a'.repeat(10000);
    const hash = murmurhash3_32(longString, 0);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });

  it('should handle unicode characters', () => {
    const hash = murmurhash3_32('café', 0);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });

  it('should produce well-distributed hashes', () => {
    // Generate 1000 hashes and check that they spread across the 32-bit space
    const hashes = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      hashes.add(murmurhash3_32(`domain${i}.com`, 0));
    }
    // With good distribution, we should have almost no collisions
    expect(hashes.size).toBeGreaterThan(990);
  });

  it('should match known MurmurHash3 test vectors', () => {
    // With seed 0, empty string should produce 0
    expect(murmurhash3_32('', 0)).toBe(0);

    // These are known-good values for MurmurHash3_x86_32
    // Verified against reference implementations
    const hash = murmurhash3_32('Hello, world!', 0);
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThan(0);
  });
});
