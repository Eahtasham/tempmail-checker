/**
 * Parse and validate an email address.
 *
 * Performs basic RFC 5322 structural validation and extracts the domain.
 * This is NOT a full RFC-compliant parser — it's designed to be fast and
 * catch the common cases for domain extraction.
 *
 * @param email - The email address to parse
 * @returns Parsed email with local and domain parts, or null if malformed
 */
export function parseEmail(email: string): { local: string; domain: string } | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();

  if (trimmed.length === 0 || trimmed.length > 320) {
    return null;
  }

  // Use lastIndexOf to handle edge cases like quoted local parts containing @
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex <= 0 || atIndex >= trimmed.length - 1) {
    return null;
  }

  const local = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1).toLowerCase();

  // Local part validation (basic)
  if (local.length === 0 || local.length > 64) {
    return null;
  }

  // Domain validation
  if (domain.length === 0 || domain.length > 253) {
    return null;
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return null;
  }

  // Domain must not start or end with dot or hyphen
  if (
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.startsWith('-') ||
    domain.endsWith('-')
  ) {
    return null;
  }

  // Domain must not have consecutive dots
  if (domain.includes('..')) {
    return null;
  }

  // Domain labels must be valid
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return null;
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return null;
    }
    // Labels must contain only alphanumeric characters and hyphens
    if (!/^[a-z0-9-]+$/.test(label)) {
      return null;
    }
  }

  return { local, domain };
}
