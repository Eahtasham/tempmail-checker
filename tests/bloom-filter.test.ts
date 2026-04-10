import { describe, it, expect } from 'vitest';
import { BloomFilter } from '../src/bloom-filter';

describe('BloomFilter', () => {
  describe('constructor', () => {
    it('should create a filter with the specified parameters', () => {
      const filter = new BloomFilter(1024, 5);
      expect(filter.numBits).toBe(1024);
      expect(filter.numHashes).toBe(5);
      expect(filter.byteLength).toBe(128); // 1024 / 8
    });
  });

  describe('create()', () => {
    it('should calculate optimal parameters', () => {
      const filter = BloomFilter.create(1000, 0.01);
      // Optimal: m ≈ 9585 bits, k ≈ 7
      expect(filter.numBits).toBeGreaterThan(9000);
      expect(filter.numBits).toBeLessThan(10000);
      expect(filter.numHashes).toBe(7);
    });

    it('should throw for invalid expectedItems', () => {
      expect(() => BloomFilter.create(0, 0.01)).toThrow();
      expect(() => BloomFilter.create(-1, 0.01)).toThrow();
    });

    it('should throw for invalid falsePositiveRate', () => {
      expect(() => BloomFilter.create(100, 0)).toThrow();
      expect(() => BloomFilter.create(100, 1)).toThrow();
      expect(() => BloomFilter.create(100, -0.5)).toThrow();
    });
  });

  describe('add() and test()', () => {
    it('should return true for added items (no false negatives)', () => {
      const filter = BloomFilter.create(100, 0.01);
      const items = ['gmail.com', 'yahoo.com', 'tempmail.com', 'guerrillamail.com'];

      for (const item of items) {
        filter.add(item);
      }

      for (const item of items) {
        expect(filter.test(item)).toBe(true);
      }
    });

    it('should never produce false negatives with many items', () => {
      const filter = BloomFilter.create(5000, 0.01);
      const items: string[] = [];

      for (let i = 0; i < 5000; i++) {
        items.push(`domain${i}.com`);
        filter.add(`domain${i}.com`);
      }

      for (const item of items) {
        expect(filter.test(item)).toBe(true);
      }
    });

    it('should return false for most items not in the set', () => {
      const filter = BloomFilter.create(1000, 0.01);

      for (let i = 0; i < 1000; i++) {
        filter.add(`added${i}.com`);
      }

      // Test items that were never added
      let falsePositives = 0;
      const testCount = 10000;

      for (let i = 0; i < testCount; i++) {
        if (filter.test(`notadded${i}.xyz`)) {
          falsePositives++;
        }
      }

      // With 1% FPR, we expect ~100 false positives out of 10000
      // Allow generous margin (3x expected) for statistical variance
      const fpr = falsePositives / testCount;
      expect(fpr).toBeLessThan(0.03);
    });
  });

  describe('serialization', () => {
    it('should correctly serialize and deserialize via base64', () => {
      const original = BloomFilter.create(500, 0.01);
      const items = ['foo.com', 'bar.com', 'baz.com', 'qux.com'];

      for (const item of items) {
        original.add(item);
      }

      // Serialize
      const base64 = original.toBase64();
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      // Deserialize
      const restored = BloomFilter.fromBase64(base64, original.numBits, original.numHashes);

      // All originally added items should still pass
      for (const item of items) {
        expect(restored.test(item)).toBe(true);
      }

      // Properties should match
      expect(restored.numBits).toBe(original.numBits);
      expect(restored.numHashes).toBe(original.numHashes);
    });

    it('should produce deterministic base64 output', () => {
      const f1 = BloomFilter.create(100, 0.01);
      const f2 = BloomFilter.create(100, 0.01);

      f1.add('test.com');
      f2.add('test.com');

      expect(f1.toBase64()).toBe(f2.toBase64());
    });
  });
});
