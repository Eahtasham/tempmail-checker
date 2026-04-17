# Understanding tempmail-checker — How It All Works

A deep-dive into the architecture, data structures, and algorithms behind `tempmail-checker`.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Naive Approach and Why It Falls Short](#the-naive-approach)
3. [Bloom Filters — The Core Innovation](#bloom-filters)
4. [The 2-Tier Pipeline — Bloom Filter + HashSet](#the-2-tier-pipeline)
5. [MurmurHash3 — The Hash Function](#murmurhash3)
6. [Subdomain Detection](#subdomain-detection)
7. [Data Flow — A Complete Walkthrough](#data-flow)
8. [Build-Time Data Generation](#build-time-data-generation)
9. [Runtime Auto-Update](#runtime-auto-update)
10. [Memory & Performance Analysis](#memory-and-performance)
11. [Why Not Just Use a Set?](#why-not-just-use-a-set)

---

## 1. The Problem <a id="the-problem"></a>

We have a list of **~5,300+ disposable email domains** (mailinator.com, guerrillamail.com, yopmail.com, etc.). Given any email address, we need to answer one question:

> **"Does this email belong to a disposable/temporary email service?"**

Requirements:
- **Fast**: O(1) lookup, even with 5,000+ domains
- **No false negatives**: If a domain IS disposable, we must NEVER say it isn't
- **Memory efficient**: Don't waste RAM storing the full list if we can avoid it
- **Subdomain-aware**: `mail.mailinator.com` should be caught even if only `mailinator.com` is listed
- **Isomorphic**: Must work in both Node.js and browsers

---

## 2. The Naive Approach and Why It Falls Short <a id="the-naive-approach"></a>

### Approach 1: Array.includes()

```javascript
const domains = ['mailinator.com', 'guerrillamail.com', ...]; // 5,300 items
domains.includes('mailinator.com'); // true
```

**Problem**: `Array.includes()` is O(n). With 5,300 domains, every single lookup scans up to 5,300 strings. For a registration endpoint handling 1,000 requests/second, that's 5.3 million string comparisons per second. Terrible.

### Approach 2: JavaScript Set

```javascript
const domains = new Set(['mailinator.com', 'guerrillamail.com', ...]);
domains.has('mailinator.com'); // true — O(1)!
```

**Better!** `Set.has()` is O(1) on average. But there's a cost:

- **Memory**: Each string in a JS Set occupies ~(56 + 2 × length) bytes due to V8's object overhead. For 5,300 domains with an average length of ~15 characters, that's roughly:
  ```
  5,300 × (56 + 30) ≈ 456,000 bytes ≈ 445 KB
  ```
- For a Node.js server, 445 KB is nothing. But for a **browser bundle**, that's significant — it's 5,300 strings that must be parsed, allocated, and stored in the heap.

### Can we do better?

Yes — with a **Bloom filter**.

---

## 3. Bloom Filters — The Core Innovation <a id="bloom-filters"></a>

A Bloom filter is a **probabilistic data structure** invented by Burton Howard Bloom in 1970. It answers set membership queries ("Is X in the set?") using dramatically less memory than storing the actual set.

### The Key Properties

| Property | Guarantee |
|---|---|
| **"Not in set" answer** | ✅ **100% certain** — never lies about absence |
| **"In set" answer** | ⚠️ **Probably correct** — small chance of false positive |
| **Memory** | **Much smaller** than storing actual items |
| **Speed** | **O(1)** — constant time, regardless of set size |

In plain English:
- If the Bloom filter says **NO** → the item is **definitely NOT** in the set
- If the Bloom filter says **YES** → the item is **probably** in the set (but might not be)

### How It Works — Step by Step

#### The Data Structure

A Bloom filter is an **array of bits** (0s and 1s), all initially set to 0:

```
Index:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
Bits:  [0][0][0][0][0][0][0][0][0][0][0][0][0][0][0][0]
```

#### Adding an Item ("mailinator.com")

To add an item, we run it through **k different hash functions**. Each hash function produces a number that maps to a position in the bit array. We set those positions to 1.

Let's say we have **k = 3** hash functions:

```
hash1("mailinator.com") = 3
hash2("mailinator.com") = 7
hash3("mailinator.com") = 12

Index:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
Bits:  [0][0][0][1][0][0][0][1][0][0][0][0][1][0][0][0]
                ↑              ↑              ↑
              bit 3          bit 7          bit 12
```

Let's add another item, "yopmail.com":

```
hash1("yopmail.com") = 1
hash2("yopmail.com") = 7    ← same position as mailinator! (collision)
hash3("yopmail.com") = 14

Index:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
Bits:  [0][1][0][1][0][0][0][1][0][0][0][0][1][0][1][0]
           ↑     ↑           ↑              ↑     ↑
```

Notice bit 7 was already 1 from mailinator.com — that's fine, it stays 1. Bits can only go from 0→1, never 1→0.

#### Testing an Item ("Is mailinator.com in the set?")

Run the same hash functions:

```
hash1("mailinator.com") = 3   → bit[3] = 1 ✓
hash2("mailinator.com") = 7   → bit[7] = 1 ✓
hash3("mailinator.com") = 12  → bit[12] = 1 ✓

All bits are 1 → "PROBABLY YES" ✓
```

#### Testing an Item NOT in the Set ("Is gmail.com in the set?")

```
hash1("gmail.com") = 5   → bit[5] = 0 ✗  ← STOP! At least one bit is 0

Result: "DEFINITELY NO" ✓
```

The moment we find ANY bit that's 0, we know for certain the item was never added. This is why **false negatives are impossible**.

#### How False Positives Happen ("Is notadded.com in the set?")

```
hash1("notadded.com") = 1   → bit[1] = 1 ✓  (set by yopmail.com)
hash2("notadded.com") = 3   → bit[3] = 1 ✓  (set by mailinator.com)
hash3("notadded.com") = 14  → bit[14] = 1 ✓ (set by yopmail.com)

All bits are 1 → "PROBABLY YES"... but notadded.com was never added!
```

This is a **false positive** — the bits just happened to be set by other items. The more items you add, the more bits get set to 1, and the more likely false positives become.

### The Math: Choosing Optimal Parameters

Given:
- **n** = number of items to store (5,361 domains)
- **p** = desired false positive rate (0.01 = 1%)

We calculate:
- **m** = optimal number of bits
- **k** = optimal number of hash functions

**Formula for optimal bit array size:**
```
m = -n × ln(p) / (ln(2))²
m = -5361 × ln(0.01) / (0.693)²
m = -5361 × (-4.605) / 0.480
m ≈ 51,386 bits
```

**Formula for optimal number of hash functions:**
```
k = (m / n) × ln(2)
k = (51386 / 5361) × 0.693
k ≈ 6.64 → rounded to 7
```

**Our actual parameters:**
```
Bit array size:   51,386 bits = 6,424 bytes ≈ 6.3 KB
Hash functions:   7
Expected FPR:     ~1%
```

Compare this to the full Set: **6.3 KB vs ~445 KB** — that's a **70× reduction** in memory!

### Our Implementation

```
┌─────────────────────────────────────────────────────────┐
│                    BloomFilter Class                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  bits: Uint8Array(6424)    ← the bit array (6.3 KB)    │
│  numBits: 51386            ← total number of bits       │
│  numHashes: 7              ← number of hash functions   │
│                                                         │
│  add(item) ──→ compute 7 positions, set bits to 1       │
│  test(item) ──→ compute 7 positions, check if all = 1   │
│                                                         │
│  toBase64() ──→ serialize for bundling                  │
│  fromBase64() ──→ restore from serialized data          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The bit array is stored as a `Uint8Array` — each byte holds 8 bits, so 51,386 bits = 6,424 bytes.

To set/read individual bits, we use bitwise operations:
```typescript
// Set bit at position `pos`
this.bits[pos >> 3] |= (1 << (pos & 7));
//        ↑ byte index    ↑ bit within that byte

// Test bit at position `pos`
(this.bits[pos >> 3] & (1 << (pos & 7))) !== 0
```

**`pos >> 3`** = `pos / 8` (integer division) → which byte
**`pos & 7`** = `pos % 8` → which bit within that byte

---

## 4. The 2-Tier Pipeline — Bloom Filter + HashSet <a id="the-2-tier-pipeline"></a>

The Bloom filter alone has a problem: ~1% false positives. That means ~1 in 100 legitimate emails would be **incorrectly flagged** as disposable.

**Solution**: Use the Bloom filter as a **fast pre-check**, then confirm with an exact-match HashSet.

```
                    Email Input
                        │
                        ▼
              ┌─────────────────┐
              │  BLOOM FILTER   │
              │   (Layer 1)     │
              │   6.3 KB        │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │                 │
         "Definitely          "Maybe
          NOT in set"         in set"
              │                 │
              ▼                 ▼
        ┌──────────┐    ┌──────────────┐
        │ ✅ VALID  │    │   HASH SET   │
        │ (skip     │    │  (Layer 2)   │
        │  layer 2) │    │  ~350 KB     │
        └──────────┘    └──────┬───────┘
                               │
                      ┌────────┴────────┐
                      │                 │
                 Exact match       No match
                      │            (bloom FP)
                      ▼                 │
              ┌──────────────┐          ▼
              │ 🚫 DISPOSABLE │    ┌──────────┐
              └──────────────┘    │ ✅ VALID  │
                                  └──────────┘
```

### Why This Is Brilliant

**For legitimate emails (99%+ of queries):**
```
gmail.com → Bloom filter says "DEFINITELY NOT" → Skip HashSet → Done!
             ↳ Only 7 hash computations + 7 bit checks = ~50 nanoseconds
```

**For disposable emails:**
```
mailinator.com → Bloom filter says "MAYBE" → HashSet confirms → Disposable!
                  ↳ 7 hash computations + 1 Set.has() lookup
```

**For that rare ~1% false positive:**
```
rare-legit.com → Bloom filter says "MAYBE" → HashSet says NO → Valid!
                  ↳ 7 hash computations + 1 Set.has() lookup
                  ↳ Only ~1 in 100 legitimate domains hit this path
```

### The Key Insight

> **~99% of all lookups are resolved by the Bloom filter alone.**
> The HashSet exists only to eliminate the ~1% false positive rate.

The Bloom filter is like a bouncer at a club with a guest list. He can quickly tell if you're **definitely NOT on the list** (you can leave). But if he thinks you **might** be on the list, he calls the manager (HashSet) to verify.

---

## 5. MurmurHash3 — The Hash Function <a id="murmurhash3"></a>

The Bloom filter needs **k = 7** independent hash functions. Instead of implementing 7 separate functions, we use a technique called **double hashing**:

```
h(i) = (h1 + i × h2) mod m
```

Where:
- **h1** = MurmurHash3(item, seed=0)
- **h2** = MurmurHash3(item, seed=h1)
- **i** = 0, 1, 2, ..., 6 (for 7 hash functions)
- **m** = 51,386 (bit array size)

This gives us 7 independent-looking positions from just **2 hash computations**.

### What is MurmurHash3?

MurmurHash3 is a **non-cryptographic** hash function designed for speed. It was created by Austin Appleby in 2008.

Properties:
- **Fast**: ~4 bytes per cycle on modern CPUs
- **Well-distributed**: Produces uniformly distributed hash values
- **Deterministic**: Same input always produces same output
- **Not cryptographic**: Not suitable for passwords/security (but we don't need that)

### How It Works (simplified)

MurmurHash3 processes the input string in 4-byte chunks:

```
Input: "mailinator.com" (14 bytes)

Step 1: Process 4-byte blocks
  Block 1: "mail" → multiply, rotate, XOR
  Block 2: "inat" → multiply, rotate, XOR
  Block 3: "or.c" → multiply, rotate, XOR

Step 2: Process remaining bytes (tail)
  Tail: "om" (2 bytes) → multiply, rotate, XOR

Step 3: Finalization (avalanche)
  XOR-shift and multiply to ensure all bits are well-mixed

Result: 32-bit unsigned integer (e.g., 2847563891)
```

The "avalanche" step is crucial — it ensures that changing even 1 bit of input changes ~50% of the output bits. This gives us uniform distribution.

### Why Not SHA-256 or MD5?

Cryptographic hashes are **way too slow** for Bloom filters. We don't need collision resistance or one-way properties. We just need speed and uniform distribution.

| Hash Function | Speed (approx) | Use Case |
|---|---|---|
| MurmurHash3 | ~3 GB/s | Hash tables, Bloom filters ✅ |
| MD5 | ~500 MB/s | Legacy checksums |
| SHA-256 | ~200 MB/s | Cryptographic security |

MurmurHash3 is **15× faster** than SHA-256 — a huge win when we're calling it 14 times per email check (7 positions × 2 hashes).

---

## 6. Subdomain Detection <a id="subdomain-detection"></a>

### The Attack Vector

A clever attacker might try to bypass the filter by using a subdomain:

```
user@mailinator.com        ← blocked ✅
user@mail.mailinator.com   ← blocked? 🤔
user@sub.mail.mailinator.com ← blocked? 🤔🤔
```

If we only check the exact domain, subdomains slip through. That's a major vulnerability.

### Our Solution: Domain Hierarchy Walking

Given `sub.mail.mailinator.com`, we extract ALL checkable domain levels:

```
sub.mail.mailinator.com  →  ["sub.mail.mailinator.com",
                              "mail.mailinator.com",
                              "mailinator.com"]
```

Then we check **each level** through the 2-tier pipeline. If ANY level matches, the email is disposable.

### The TLD Problem

Why not just split by dots and check everything? Because of multi-part TLDs:

```
user@sub.example.co.uk

Naive split: ["sub.example.co.uk", "example.co.uk", "co.uk", "uk"]
                                                      ↑ WRONG!
```

If someone added `co.uk` to the blocklist (by mistake), ALL `.co.uk` emails would be blocked. That's catastrophic.

### Public Suffix List (via tldts)

We use the `tldts` library, which knows about all valid TLDs from the [Public Suffix List](https://publicsuffix.org/):

```
tldts.parse("sub.example.co.uk")
→ {
    publicSuffix: "co.uk",      ← the TLD part (don't check this!)
    domain: "example.co.uk",    ← the registrable domain
    subdomain: "sub"            ← the subdomain part
  }
```

So for `sub.example.co.uk`, we only check:
```
["sub.example.co.uk", "example.co.uk"]
                                         ← "co.uk" and "uk" are EXCLUDED
```

### Visual Flow

```
Input: "user@a.b.tempmail.com"
          │
          ▼
  Parse: domain = "a.b.tempmail.com"
          │
          ▼
  getDomainLevels("a.b.tempmail.com")
          │
          ▼
  Levels to check:
    ①  "a.b.tempmail.com"   → Bloom: MAYBE → HashSet: NO  (not in list)
    ②  "b.tempmail.com"     → Bloom: MAYBE → HashSet: NO  (not in list)
    ③  "tempmail.com"       → Bloom: MAYBE → HashSet: YES ← MATCH!
          │
          ▼
  Result: { disposable: true, reason: 'subdomain_match', matchedDomain: 'tempmail.com' }
```

---

## 7. Data Flow — A Complete Walkthrough <a id="data-flow"></a>

Let's trace what happens when you call `isDisposable("user@mail.guerrillamail.com")`.

### Step 1: Function Entry

```typescript
isDisposable("user@mail.guerrillamail.com")
  → getDefaultValidator()     // Gets or creates singleton EmailValidator
  → validator.check("user@mail.guerrillamail.com")
```

### Step 2: Parse Email

```typescript
parseEmail("user@mail.guerrillamail.com")
  → { local: "user", domain: "mail.guerrillamail.com" }
```

Validates:
- ✅ Has exactly one `@`
- ✅ Local part is 1-64 characters
- ✅ Domain is 1-253 characters
- ✅ Domain has at least one dot
- ✅ No consecutive dots, no leading/trailing hyphens
- ✅ All domain labels are alphanumeric + hyphens

### Step 3: Expand Domain Hierarchy

```typescript
getDomainLevels("mail.guerrillamail.com")
  → ["mail.guerrillamail.com", "guerrillamail.com"]
```

tldts identifies `com` as the public suffix, so we stop before generating bare `com`.

### Step 4: Check Allowlist

```typescript
for each level in ["mail.guerrillamail.com", "guerrillamail.com"]:
  allowlist.has(level)?  → false, false
```

No allowlist match. Continue.

### Step 5: Check Custom Blocklist

```typescript
for each level in ["mail.guerrillamail.com", "guerrillamail.com"]:
  customBlocklist.has(level)?  → false, false
```

No custom blocklist match. Continue.

### Step 6: Two-Tier Pipeline

**Iteration 1: "mail.guerrillamail.com"**

```
Bloom filter:
  h1 = murmurhash3("mail.guerrillamail.com", 0)     = 3847291056
  h2 = murmurhash3("mail.guerrillamail.com", h1)     = 1293847562

  Position 0: (h1 + 0*h2) % 51386 = 3847291056 % 51386 = position X → bit = 0?

  → If ANY bit is 0: "DEFINITELY NOT" → skip to next level
  → (Most likely outcome for a domain not in the main list)
```

**Iteration 2: "guerrillamail.com"**

```
Bloom filter:
  h1 = murmurhash3("guerrillamail.com", 0)    = [some value]
  h2 = murmurhash3("guerrillamail.com", h1)   = [some value]

  All 7 positions → all bits are 1 → "MAYBE IN SET"

HashSet:
  hashSet.has("guerrillamail.com") → true ← CONFIRMED!
```

### Step 7: Return Result

```typescript
{
  disposable: true,
  email: "user@mail.guerrillamail.com",
  domain: "mail.guerrillamail.com",
  reason: "subdomain_match",      // Parent domain matched, not the exact domain
  matchedDomain: "guerrillamail.com"  // The domain that triggered the match
}
```

### Priority Order Summary

```
1. Invalid email?     → { disposable: false, reason: 'invalid_email' }
2. In allowlist?      → { disposable: false, reason: 'allowlist' }
3. In custom block?   → { disposable: true,  reason: 'custom_blocklist' }
4. In main blocklist? → { disposable: true,  reason: 'blocklist' or 'subdomain_match' }
5. Not found?         → { disposable: false, reason: 'not_found' }
```

The allowlist has the **highest priority** — it can override even the main blocklist. This lets users whitelist domains that might be incorrectly flagged.

---

## 8. Build-Time Data Generation <a id="build-time-data-generation"></a>

When you run `npm run build:data`, here's what happens:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     scripts/build-data.ts                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. FETCH                                                          │
│     ↓                                                              │
│     GitHub Raw URL → HTTP GET → response.text()                     │
│     ↓                                                              │
│     "0-mail.com\n01022.hk\n..." (raw text file)                    │
│                                                                     │
│  2. PARSE                                                          │
│     ↓                                                              │
│     Split by \n → trim → lowercase → filter empty/comments         │
│     ↓                                                              │
│     ["0-mail.com", "01022.hk", ...] (5,361 strings)                │
│                                                                     │
│  3. GENERATE domains.ts                                            │
│     ↓                                                              │
│     Write TypeScript file with the full array                       │
│     export const DISPOSABLE_DOMAINS: readonly string[] = [...]      │
│                                                                     │
│  4. GENERATE BLOOM FILTER                                          │
│     ↓                                                              │
│     BloomFilter.create(5361, 0.01) → m=51386 bits, k=7 hashes      │
│     ↓                                                              │
│     Add all 5,361 domains to the filter                             │
│     ↓                                                              │
│     filter.toBase64() → "AAABAA...==" (8,568 chars)                │
│     ↓                                                              │
│     Write to src/data/bloom-data.ts                                 │
│                                                                     │
│  5. VERIFY                                                         │
│     ↓                                                              │
│     Test every domain against the filter                            │
│     ↓                                                              │
│     Confirm: 0 false negatives                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The generated `bloom-data.ts` contains the pre-computed filter as a **base64 string**:

```typescript
export const BLOOM_FILTER_BASE64 = 'AAAB...==';  // 8,568 chars = 6,424 bytes
export const BLOOM_FILTER_NUM_HASHES = 7;
export const BLOOM_FILTER_SIZE = 51386;           // bits
```

At runtime, `BloomFilter.fromBase64()` decodes this back into a `Uint8Array`. No computation needed — the filter is ready to use instantly.

### Why Base64?

Base64 encodes binary data as ASCII text, making it safe to embed in a TypeScript source file. The overhead is ~33% (6,424 binary bytes → 8,568 base64 chars), which is negligible.

---

## 9. Runtime Auto-Update <a id="runtime-auto-update"></a>

The bundled domain list is a snapshot from build time. New disposable services appear constantly. The auto-update feature keeps the list fresh:

```typescript
const validator = new EmailValidator({
  autoUpdate: true,              // Enable periodic refresh
  updateInterval: 86400000,      // Every 24 hours (default)
});
```

### What Happens on Refresh

```
1. fetch(GITHUB_RAW_URL)
   ↓
2. Parse response → string[]
   ↓
3. BloomFilter.create(newDomains.length, 0.01)
   ↓
4. Add all new domains to filter
   ↓
5. Create new Set(newDomains)
   ↓
6. Replace this.bloomFilter & this.hashSet atomically
   ↓
7. Re-add custom blocklist domains to new structures
   ↓
8. Update this.lastUpdated timestamp
```

The old filter/set is garbage collected. The validator is usable throughout the refresh — there's no downtime.

### Timer Management

The auto-update uses `setInterval()` with `.unref()` on Node.js:

```typescript
this.updateTimer = setInterval(() => { ... }, interval);

// .unref() prevents the timer from keeping Node.js alive
// So your server can shut down cleanly even if the timer is running
this.updateTimer.unref();
```

Always call `validator.destroy()` when you're done to clean up the timer.

---

## 10. Memory & Performance Analysis <a id="memory-and-performance"></a>

### Memory Breakdown

```
┌──────────────────────┬───────────┬──────────────────────────────┐
│ Component            │ Size      │ Notes                        │
├──────────────────────┼───────────┼──────────────────────────────┤
│ Bloom Filter         │ ~6.3 KB   │ Uint8Array(6424)             │
│ HashSet (domains)    │ ~350 KB   │ 5,361 strings in a V8 Set    │
│ Domain list (source) │ ~70 KB    │ Raw string array (GC'd after │
│                      │           │ Set construction in bundled  │
│                      │           │ mode)                        │
│ Custom lists         │ ~0.1 KB   │ Typically <10 domains        │
├──────────────────────┼───────────┼──────────────────────────────┤
│ TOTAL                │ ~425 KB   │ Runtime memory               │
└──────────────────────┴───────────┴──────────────────────────────┘
```

### Performance Characteristics

```
┌──────────────────────────────┬──────────────────────────────────┐
│ Operation                    │ Time                             │
├──────────────────────────────┼──────────────────────────────────┤
│ Bloom filter test            │ ~50 ns (7 hashes + 7 bit reads) │
│ HashSet lookup               │ ~100 ns (hash + equality check)  │
│ Full check (legitimate)      │ ~200 ns (bloom rejects early)    │
│ Full check (disposable)      │ ~300 ns (bloom + hashset)        │
│ Full check with subdomain    │ ~600 ns (2-3 levels checked)     │
│ 10,000 emails batch          │ < 50 ms                          │
│ Validator initialization     │ ~5 ms (base64 decode + Set)      │
└──────────────────────────────┴──────────────────────────────────┘
```

### Bundle Size (what ships to NPM)

```
dist/index.mjs     92.67 KB   (ESM, minified, includes embedded data)
dist/index.cjs     92.73 KB   (CJS, minified, includes embedded data)
dist/index.d.ts    10.50 KB   (TypeScript declarations)
dist/index.d.cts   10.50 KB   (CTS declarations)

Total tarball:     198 KB     (compressed with gzip)
```

---

## 11. Why Not Just Use a Set? <a id="why-not-just-use-a-set"></a>

Fair question! For a Node.js backend with plenty of RAM, a plain `Set` would actually work fine. Here's when the Bloom filter adds real value:

### When the Bloom Filter Matters

| Scenario | Bloom Filter Value |
|---|---|
| **Browser bundles** | High — 6KB vs 70KB+ of domain strings |
| **Edge/serverless** (Cloudflare Workers, Lambda@Edge) | High — memory is limited and expensive |
| **Very high traffic** | Medium — bloom resolves 99% of queries without touching the Set |
| **Standard Node.js server** | Low — RAM is cheap, both are O(1) |

### When to Use Just a Set

If you're building a simple server-side validator and don't care about bundle size, a plain `Set` is simpler. But `tempmail-checker` uses BOTH — you get the best of both worlds automatically.

### The Real Advantage: Architecture

The 2-tier architecture isn't just about performance. It's about **correctness with efficiency**:

```
Bloom Filter alone:   Fast ✅  Memory-efficient ✅  False positives ❌
HashSet alone:         Fast ✅  Correct ✅          Memory-hungry ❌
Bloom + HashSet:       Fast ✅  Correct ✅          Memory-efficient ✅ (for the fast path)
```

The Bloom filter handles the **common case** (legitimate emails) with minimal memory access. The HashSet handles the **uncommon case** (suspicious domains) with perfect accuracy. Together, they're better than either alone.

---

## Summary

```
                    tempmail-checker
                    ┌─────────────────────────────────────┐
                    │                                     │
   Build Time       │  GitHub → Parse → Bloom Filter      │
   (npm run         │                    ↓                │
    build:data)     │              Serialize to Base64     │
                    │              + Full domain array     │
                    │              → Embed in source       │
                    │                                     │
   ─ ─ ─ ─ ─ ─ ─ ─ ┤                                     │
                    │                                     │
   Runtime          │  Email → Parse → Subdomain Levels   │
                    │                     ↓               │
                    │  [allowlist] → [custom block]       │
                    │                     ↓               │
                    │  ┌─ Bloom Filter (6KB) ──┐         │
                    │  │ "Definitely NOT"      │         │
                    │  │    → ✅ VALID          │         │
                    │  │ "Maybe YES"           │         │
                    │  │    → HashSet confirm  │         │
                    │  │      → ✅ or 🚫       │         │
                    │  └──────────────────────┘         │
                    │                                     │
                    └─────────────────────────────────────┘
```

**Key Takeaways:**
1. **Bloom filter = fast rejection** — eliminates 99% of queries in nanoseconds
2. **HashSet = perfect accuracy** — confirms the 1% ambiguous cases
3. **Subdomain walking = bypass prevention** — catches nested domains
4. **Pre-computed at build time** — zero initialization cost
5. **Auto-update at runtime** — stays fresh without republishing
