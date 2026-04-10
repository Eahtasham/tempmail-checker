import { BloomFilter } from './bloom-filter';

/**
 * Default URL for the disposable email domains blocklist.
 */
export const DEFAULT_DOMAINS_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

/**
 * Fetch the latest disposable email domains from a remote source.
 *
 * Uses the native `fetch()` API (Node.js 18+ and all modern browsers).
 *
 * @param url - URL to fetch from (defaults to the disposable-email-domains GitHub repo)
 * @returns Array of lowercase domain strings
 * @throws Error if the fetch fails or returns a non-OK status
 */
export async function fetchLatestDomains(url?: string): Promise<string[]> {
  const targetUrl = url ?? DEFAULT_DOMAINS_URL;

  const response = await fetch(targetUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch domain list: ${response.status} ${response.statusText} from ${targetUrl}`,
    );
  }

  const text = await response.text();

  return text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Rebuild a Bloom filter and HashSet from a fresh domain list.
 *
 * Used after fetching an updated domain list via `fetchLatestDomains()`.
 *
 * @param domains - Array of domain strings
 * @param falsePositiveRate - Target false positive rate for the bloom filter (default: 0.01)
 * @returns New BloomFilter and HashSet pre-populated with the domains
 */
export function rebuildFromDomains(
  domains: string[],
  falsePositiveRate: number = 0.01,
): { bloomFilter: BloomFilter; hashSet: Set<string> } {
  const bloomFilter = BloomFilter.create(domains.length, falsePositiveRate);
  const hashSet = new Set<string>();

  for (const domain of domains) {
    bloomFilter.add(domain);
    hashSet.add(domain);
  }

  return { bloomFilter, hashSet };
}
