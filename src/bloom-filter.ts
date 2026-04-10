import { murmurhash3_32 } from './hash';

/**
 * A space-efficient probabilistic data structure for set membership testing.
 *
 * - `test()` returning `false` means "definitely NOT in the set" (no false negatives)
 * - `test()` returning `true` means "MAYBE in the set" (possible false positive)
 *
 * Uses MurmurHash3 with the double-hashing technique: h(i) = h1 + i*h2
 * This gives us k independent hash functions from just 2 hash computations.
 */
export class BloomFilter {
  private bits: Uint8Array;
  private _numHashes: number;
  private _numBits: number;

  /**
   * Create a Bloom filter with a specific bit array size and number of hash functions.
   * For automatic parameter calculation, use `BloomFilter.create()` instead.
   */
  constructor(numBits: number, numHashes: number) {
    this._numBits = numBits;
    this._numHashes = numHashes;
    this.bits = new Uint8Array(Math.ceil(numBits / 8));
  }

  /** Number of bits in the filter */
  get numBits(): number {
    return this._numBits;
  }

  /** Number of hash functions */
  get numHashes(): number {
    return this._numHashes;
  }

  /** Size of the underlying byte array */
  get byteLength(): number {
    return this.bits.length;
  }

  /**
   * Create a Bloom filter with optimal parameters for the expected number
   * of items and desired false positive rate.
   *
   * @param expectedItems - Number of items to insert
   * @param falsePositiveRate - Target false positive rate (0.01 = 1%)
   */
  static create(expectedItems: number, falsePositiveRate: number = 0.01): BloomFilter {
    if (expectedItems <= 0) {
      throw new Error('expectedItems must be positive');
    }
    if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
      throw new Error('falsePositiveRate must be between 0 and 1 (exclusive)');
    }

    // Optimal bit array size: m = -n * ln(p) / (ln(2))^2
    const numBits = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2),
    );

    // Optimal number of hash functions: k = (m/n) * ln(2)
    const numHashes = Math.max(1, Math.round((numBits / expectedItems) * Math.LN2));

    return new BloomFilter(numBits, numHashes);
  }

  /**
   * Restore a Bloom filter from a base64-encoded bit array.
   * Works in both Node.js (Buffer) and browsers (atob).
   */
  static fromBase64(data: string, numBits: number, numHashes: number): BloomFilter {
    const filter = new BloomFilter(numBits, numHashes);

    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(data, 'base64');
      filter.bits = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      filter.bits = bytes;
    }

    return filter;
  }

  /**
   * Add an item to the filter.
   * Once added, `test(item)` will always return `true` for this item.
   */
  add(item: string): void {
    const positions = this.getPositions(item);
    for (const pos of positions) {
      this.bits[pos >> 3]! |= 1 << (pos & 7);
    }
  }

  /**
   * Test whether an item might be in the set.
   *
   * @returns `false` — item is DEFINITELY not in the set
   * @returns `true` — item is PROBABLY in the set (false positive possible)
   */
  test(item: string): boolean {
    const positions = this.getPositions(item);
    for (const pos of positions) {
      if (!(this.bits[pos >> 3]! & (1 << (pos & 7)))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Serialize the bit array to a base64 string.
   * Works in both Node.js and browsers.
   */
  toBase64(): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(this.bits).toString('base64');
    }

    let binary = '';
    for (let i = 0; i < this.bits.length; i++) {
      binary += String.fromCharCode(this.bits[i]!);
    }
    return btoa(binary);
  }

  /**
   * Compute bit positions for a given item using double-hashing.
   * h(i) = (h1 + i * h2) mod m
   */
  private getPositions(item: string): number[] {
    const positions: number[] = [];
    const h1 = murmurhash3_32(item, 0);
    const h2 = murmurhash3_32(item, h1);

    for (let i = 0; i < this._numHashes; i++) {
      const combined = (h1 + Math.imul(i, h2)) >>> 0;
      positions.push(combined % this._numBits);
    }

    return positions;
  }
}
