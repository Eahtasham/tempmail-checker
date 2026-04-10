import { BloomFilter } from './bloom-filter';
import { parseEmail } from './email-parser';
import { getDomainLevels } from './subdomain';
import { fetchLatestDomains, rebuildFromDomains } from './updater';
import { DISPOSABLE_DOMAINS } from './data/domains';
import {
  BLOOM_FILTER_BASE64,
  BLOOM_FILTER_NUM_HASHES,
  BLOOM_FILTER_SIZE,
} from './data/bloom-data';
import type { ValidationResult, ValidatorOptions, ValidatorStats } from './types';

/**
 * The default URL for fetching the disposable email domain list.
 */
const DEFAULT_UPDATE_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

/**
 * Stateful email validator with a 2-tier Bloom Filter → HashSet pipeline.
 *
 * Supports custom blocklists/allowlists, subdomain detection, and
 * optional auto-refresh from a remote domain list.
 *
 * @example
 * ```typescript
 * import { EmailValidator } from 'tempmail-checker';
 *
 * const validator = new EmailValidator({
 *   customBlocklist: ['my-spam-domain.com'],
 *   customAllowlist: ['legit-but-flagged.com'],
 * });
 *
 * const result = validator.check('user@tempmail.com');
 * console.log(result);
 * // {
 * //   disposable: true,
 * //   email: 'user@tempmail.com',
 * //   domain: 'tempmail.com',
 * //   reason: 'blocklist',
 * //   matchedDomain: 'tempmail.com'
 * // }
 *
 * validator.destroy(); // Clean up auto-update timer if enabled
 * ```
 */
export class EmailValidator {
  private bloomFilter: BloomFilter;
  private hashSet: Set<string>;
  private allowlist: Set<string>;
  private customBlocklist: Set<string>;
  private updateTimer?: ReturnType<typeof setInterval>;
  private lastUpdated: Date | null = null;
  private readonly options: Required<ValidatorOptions>;

  constructor(options?: ValidatorOptions) {
    this.options = {
      customBlocklist: options?.customBlocklist ?? [],
      customAllowlist: options?.customAllowlist ?? [],
      autoUpdate: options?.autoUpdate ?? false,
      updateInterval: options?.updateInterval ?? 24 * 60 * 60 * 1000,
      updateUrl: options?.updateUrl ?? DEFAULT_UPDATE_URL,
      falsePositiveRate: options?.falsePositiveRate ?? 0.01,
    };

    // Initialize from bundled pre-computed data
    this.bloomFilter = BloomFilter.fromBase64(
      BLOOM_FILTER_BASE64,
      BLOOM_FILTER_SIZE,
      BLOOM_FILTER_NUM_HASHES,
    );
    this.hashSet = new Set(DISPOSABLE_DOMAINS);

    // Set up custom lists
    this.allowlist = new Set(this.options.customAllowlist.map((d) => d.toLowerCase()));
    this.customBlocklist = new Set(this.options.customBlocklist.map((d) => d.toLowerCase()));

    // Add custom blocklist domains to both data structures
    for (const domain of this.customBlocklist) {
      this.bloomFilter.add(domain);
      this.hashSet.add(domain);
    }

    // Start auto-update if enabled
    if (this.options.autoUpdate) {
      this.startAutoUpdate();
    }
  }

  /**
   * Check whether an email address uses a disposable/temporary domain.
   *
   * Pipeline:
   * 1. Parse email → extract domain → expand subdomain hierarchy
   * 2. Check custom allowlist (if match → valid)
   * 3. Check custom blocklist (if match → disposable)
   * 4. Bloom filter fast-path (if "definitely not" → skip to next subdomain level)
   * 5. HashSet exact match (if match → disposable, else bloom false positive)
   *
   * @param email - The email address to validate
   * @returns A rich validation result object
   */
  check(email: string): ValidationResult {
    const parsed = parseEmail(email);

    if (!parsed) {
      return {
        disposable: false,
        email,
        domain: '',
        reason: 'invalid_email',
      };
    }

    const { domain } = parsed;
    const domainLevels = getDomainLevels(domain);

    // 1. Check allowlist first (highest priority)
    for (const level of domainLevels) {
      if (this.allowlist.has(level)) {
        return {
          disposable: false,
          email,
          domain,
          reason: 'allowlist',
          matchedDomain: level,
        };
      }
    }

    // 2. Check custom blocklist
    for (const level of domainLevels) {
      if (this.customBlocklist.has(level)) {
        return {
          disposable: true,
          email,
          domain,
          reason: 'custom_blocklist',
          matchedDomain: level,
        };
      }
    }

    // 3. Two-tier pipeline: Bloom Filter → HashSet
    for (const level of domainLevels) {
      // Layer 1: Bloom filter fast-path
      if (!this.bloomFilter.test(level)) {
        // Bloom says "definitely NOT in set" → skip this level
        continue;
      }

      // Layer 2: Bloom says "maybe" → exact match with HashSet
      if (this.hashSet.has(level)) {
        return {
          disposable: true,
          email,
          domain,
          reason: level === domain ? 'blocklist' : 'subdomain_match',
          matchedDomain: level,
        };
      }
      // HashSet says no → bloom false positive, continue to next level
    }

    // 4. Not found in any list
    return {
      disposable: false,
      email,
      domain,
      reason: 'not_found',
    };
  }

  /**
   * Check multiple email addresses at once.
   *
   * @param emails - Array of email addresses to validate
   * @returns Array of validation results in the same order
   */
  checkMany(emails: string[]): ValidationResult[] {
    return emails.map((email) => this.check(email));
  }

  /**
   * Manually refresh the domain list from the configured remote source.
   *
   * Rebuilds both the Bloom filter and HashSet from the freshly fetched data.
   * Custom blocklist/allowlist entries are preserved after refresh.
   *
   * @throws Error if the fetch fails
   */
  async refresh(): Promise<void> {
    const domains = await fetchLatestDomains(this.options.updateUrl);
    const { bloomFilter, hashSet } = rebuildFromDomains(domains, this.options.falsePositiveRate);

    this.bloomFilter = bloomFilter;
    this.hashSet = hashSet;

    // Re-add custom blocklist to the new data structures
    for (const domain of this.customBlocklist) {
      this.bloomFilter.add(domain);
      this.hashSet.add(domain);
    }

    this.lastUpdated = new Date();
  }

  /**
   * Get statistics about the validator's current state.
   */
  stats(): ValidatorStats {
    return {
      totalDomains: this.hashSet.size,
      bloomFilterSizeBytes: this.bloomFilter.byteLength,
      hashSetSize: this.hashSet.size,
      customBlocklistSize: this.customBlocklist.size,
      allowlistSize: this.allowlist.size,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Clean up resources. Stops the auto-update timer if running.
   * Call this when you're done with the validator to prevent memory leaks.
   */
  destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * Start the periodic auto-update interval.
   */
  private startAutoUpdate(): void {
    this.updateTimer = setInterval(() => {
      this.refresh().catch(() => {
        // Silently fail — keep using cached data.
        // In production, users should attach their own error handling via refresh().
      });
    }, this.options.updateInterval);

    // Prevent the timer from keeping the Node.js process alive
    if (
      this.updateTimer &&
      typeof this.updateTimer === 'object' &&
      'unref' in this.updateTimer
    ) {
      (this.updateTimer as NodeJS.Timeout).unref();
    }
  }
}
