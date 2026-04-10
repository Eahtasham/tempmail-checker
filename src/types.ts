/**
 * Result returned by every email validation call.
 */
export interface ValidationResult {
  /** Whether the email uses a disposable/temporary domain */
  disposable: boolean;

  /** The full email address that was checked */
  email: string;

  /** The domain extracted from the email */
  domain: string;

  /** Why this result was reached */
  reason:
    | 'blocklist'
    | 'subdomain_match'
    | 'custom_blocklist'
    | 'allowlist'
    | 'not_found'
    | 'invalid_email';

  /** The specific domain that triggered the match (useful for subdomain hits) */
  matchedDomain?: string;
}

/**
 * Configuration options for the EmailValidator class.
 */
export interface ValidatorOptions {
  /** Additional domains to block (merged with the default list) */
  customBlocklist?: string[];

  /** Domains to always allow (overrides any blocklist match) */
  customAllowlist?: string[];

  /** Enable automatic list refresh from GitHub (default: false) */
  autoUpdate?: boolean;

  /** Refresh interval in milliseconds (default: 86400000 = 24 hours) */
  updateInterval?: number;

  /** Custom URL to fetch the domain list from */
  updateUrl?: string;

  /** Bloom filter false positive rate (default: 0.01 = 1%) */
  falsePositiveRate?: number;
}

/**
 * Statistics about the validator's current state.
 */
export interface ValidatorStats {
  /** Total number of domains in the hash set */
  totalDomains: number;

  /** Size of the bloom filter bit array in bytes */
  bloomFilterSizeBytes: number;

  /** Number of domains in the hash set */
  hashSetSize: number;

  /** Number of user-added custom blocklist domains */
  customBlocklistSize: number;

  /** Number of user-added custom allowlist domains */
  allowlistSize: number;

  /** Timestamp of the last remote refresh, or null if never refreshed */
  lastUpdated: Date | null;
}
