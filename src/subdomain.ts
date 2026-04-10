import { parse } from 'tldts';

/**
 * Extract all checkable domain levels from a domain string.
 *
 * Walks the domain hierarchy from most-specific to the registrable domain,
 * excluding bare TLDs (e.g., "com", "co.uk") to prevent false matches.
 *
 * Uses the Public Suffix List (via tldts) to correctly handle multi-part
 * TLDs like .co.uk, .com.au, .org.uk, etc.
 *
 * @example
 * getDomainLevels("mail.tempmail.com")
 * // → ["mail.tempmail.com", "tempmail.com"]
 *
 * @example
 * getDomainLevels("sub.example.co.uk")
 * // → ["sub.example.co.uk", "example.co.uk"]
 *
 * @example
 * getDomainLevels("tempmail.com")
 * // → ["tempmail.com"]
 *
 * @param domain - A lowercase domain string (e.g., "mail.tempmail.com")
 * @returns Array of domain levels to check, from most-specific to registrable domain
 */
export function getDomainLevels(domain: string): string[] {
  const lowerDomain = domain.toLowerCase().trim();

  if (!lowerDomain || !lowerDomain.includes('.')) {
    return lowerDomain ? [lowerDomain] : [];
  }

  const parsed = parse(lowerDomain);
  const publicSuffix = parsed.publicSuffix;

  // If we can't determine the public suffix, fall back to simple splitting
  // but skip the last part (assumed TLD)
  if (!publicSuffix) {
    return buildLevelsFallback(lowerDomain);
  }

  const parts = lowerDomain.split('.');
  const suffixParts = publicSuffix.split('.').length;

  // We need at least suffixParts + 1 labels to have a registrable domain
  if (parts.length <= suffixParts) {
    return [lowerDomain];
  }

  const levels: string[] = [];

  // Generate domain levels from most-specific to registrable domain
  // Stop before we'd generate just the TLD
  const stopAt = parts.length - suffixParts;
  for (let i = 0; i < stopAt; i++) {
    levels.push(parts.slice(i).join('.'));
  }

  // Ensure we always have at least one level
  if (levels.length === 0) {
    levels.push(lowerDomain);
  }

  return levels;
}

/**
 * Fallback domain level extraction when tldts can't determine the public suffix.
 * Simply walks up the hierarchy, skipping the last label (assumed TLD).
 */
function buildLevelsFallback(domain: string): string[] {
  const parts = domain.split('.');
  const levels: string[] = [];

  // Generate levels, but don't go down to just the TLD
  for (let i = 0; i < parts.length - 1; i++) {
    levels.push(parts.slice(i).join('.'));
  }

  return levels.length > 0 ? levels : [domain];
}
