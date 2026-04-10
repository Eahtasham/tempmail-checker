/**
 * Build script — Fetches the latest disposable email domains from GitHub
 * and generates the bundled data files used by the package.
 *
 * Generates:
 *   - src/data/domains.ts    (full domain string array)
 *   - src/data/bloom-data.ts (pre-computed bloom filter as base64)
 *
 * Usage: npm run build:data
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// We import from the source files directly (tsx handles TypeScript)
import { BloomFilter } from '../src/bloom-filter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOMAINS_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

const FALSE_POSITIVE_RATE = 0.01;

async function main(): Promise<void> {
  console.log('📦 tempmail-checker — Data Builder\n');
  console.log(`Fetching domains from:\n  ${DOMAINS_URL}\n`);

  const response = await fetch(DOMAINS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const domains = text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  console.log(`✅ Fetched ${domains.length.toLocaleString()} domains\n`);

  // Ensure output directory exists
  const dataDir = resolve(__dirname, '..', 'src', 'data');
  mkdirSync(dataDir, { recursive: true });

  // ─── Generate domains.ts ─────────────────────────────────────────
  const domainsContent = `// AUTO-GENERATED — Do not edit manually. Run \`npm run build:data\` to regenerate.
// Source: ${DOMAINS_URL}
// Generated: ${new Date().toISOString()}
// Total domains: ${domains.length}

export const DISPOSABLE_DOMAINS: readonly string[] = ${JSON.stringify(domains, null, 2)} as const;
`;

  const domainsPath = resolve(dataDir, 'domains.ts');
  writeFileSync(domainsPath, domainsContent, 'utf-8');
  console.log(`📄 Generated domains.ts (${domains.length.toLocaleString()} domains)`);

  // ─── Generate bloom filter ───────────────────────────────────────
  const filter = BloomFilter.create(domains.length, FALSE_POSITIVE_RATE);

  for (const domain of domains) {
    filter.add(domain);
  }

  const base64 = filter.toBase64();
  const numBits = filter.numBits;
  const numHashes = filter.numHashes;
  const byteSize = filter.byteLength;

  const bloomContent = `// AUTO-GENERATED — Do not edit manually. Run \`npm run build:data\` to regenerate.
// Source: ${DOMAINS_URL}
// Generated: ${new Date().toISOString()}
// Domains: ${domains.length}
// False positive rate: ${FALSE_POSITIVE_RATE}
// Bit array size: ${numBits.toLocaleString()} bits (${byteSize.toLocaleString()} bytes)
// Hash functions: ${numHashes}

export const BLOOM_FILTER_BASE64 = '${base64}';
export const BLOOM_FILTER_NUM_HASHES = ${numHashes};
export const BLOOM_FILTER_SIZE = ${numBits};
`;

  const bloomPath = resolve(dataDir, 'bloom-data.ts');
  writeFileSync(bloomPath, bloomContent, 'utf-8');

  console.log(`📄 Generated bloom-data.ts`);
  console.log(`   ├─ Bits: ${numBits.toLocaleString()} (${byteSize.toLocaleString()} bytes)`);
  console.log(`   ├─ Hash functions: ${numHashes}`);
  console.log(`   ├─ Base64 size: ${base64.length.toLocaleString()} chars`);
  console.log(`   └─ Target FPR: ${(FALSE_POSITIVE_RATE * 100).toFixed(1)}%`);

  // ─── Verify bloom filter correctness ─────────────────────────────
  console.log(`\n🔍 Verifying bloom filter...`);

  let falseNegatives = 0;
  for (const domain of domains) {
    if (!filter.test(domain)) {
      falseNegatives++;
    }
  }

  if (falseNegatives > 0) {
    console.error(`❌ ERROR: ${falseNegatives} false negatives detected! Bloom filter is broken.`);
    process.exit(1);
  }

  console.log(`✅ Zero false negatives — all ${domains.length.toLocaleString()} domains pass\n`);
  console.log('🎉 Data build complete!');
}

main().catch((err) => {
  console.error('❌ Data build failed:', err);
  process.exit(1);
});
