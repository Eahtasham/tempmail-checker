# tempmail-checker

[![npm version](https://img.shields.io/npm/v/tempmail-checker.svg)](https://www.npmjs.com/package/tempmail-checker)
[![CI](https://github.com/Eahtasham/tempmail-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/Eahtasham/tempmail-checker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> Fast, isomorphic disposable email detector with a **2-tier Bloom Filter → HashSet** validation pipeline, deep subdomain detection, and auto-updating domain lists.

---

## ✨ Features

- **🚀 O(1) Lookup** — Bloom filter pre-check eliminates ~95% of queries instantly
- **🎯 Zero False Negatives** — HashSet confirms every Bloom filter positive
- **🌐 Isomorphic** — Works in Node.js and browsers
- **🔍 Subdomain Detection** — Catches `x.y.tempmail.com` even if only `tempmail.com` is listed
- **📋 5,300+ Domains** — Sourced from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
- **🔄 Auto-Update** — Optional runtime refresh from GitHub
- **📦 Tiny Bloom Filter** — ~6KB pre-computed filter, ~93KB total package
- **🧩 Dual API** — Simple functions + powerful class-based API
- **✅ Custom Lists** — Add your own blocklist/allowlist
- **📝 Rich Results** — Detailed validation result objects, not just booleans
- **🪵 Configurable Logging** — Debug, info, warn, error levels with custom handlers
- **🔌 Framework Middleware** — Ready-to-use plugins for Express and Fastify

---

## 📦 Installation

```bash
npm install tempmail-checker
```

```bash
yarn add tempmail-checker
```

```bash
pnpm add tempmail-checker
```

---

## 🚀 Quick Start

### Simple Function API

```typescript
import { isDisposable, isTemp } from 'tempmail-checker';

// Rich result object
const result = isDisposable('user@mailinator.com');
console.log(result);
// {
//   disposable: true,
//   email: 'user@mailinator.com',
//   domain: 'mailinator.com',
//   reason: 'blocklist',
//   matchedDomain: 'mailinator.com'
// }

// Quick boolean check
if (isTemp('user@guerrillamail.com')) {
  console.log('Disposable email detected!');
}
```

### Class-based API

```typescript
import { EmailValidator } from 'tempmail-checker';

const validator = new EmailValidator({
  customBlocklist: ['my-spam-domain.com'],
  customAllowlist: ['legit-but-flagged.com'],
  autoUpdate: false,
});

// Single check
const result = validator.check('user@tempmail.com');

// Batch check
const results = validator.checkMany([
  'user@gmail.com',
  'user@mailinator.com',
  'user@sub.yopmail.com',
]);

// Get stats
console.log(validator.stats());
// {
//   totalDomains: 5363,
//   bloomFilterSizeBytes: 6424,
//   hashSetSize: 5363,
//   customBlocklistSize: 1,
//   allowlistSize: 1,
//   lastUpdated: null
// }

// Clean up when done
validator.destroy();
```

---

## 🏗️ Architecture

```
  "user@mail.tempmail.com"
         │
         ▼
  ┌──────────────┐
  │  Parse Email  │──── invalid ──▶ { disposable: false, reason: 'invalid_email' }
  │  + Extract    │
  │  Subdomains   │
  └──────┬───────┘
         │
    ┌────▼─────┐    ┌───────────┐
    │ ALLOWLIST │───▶│ ✅ VALID  │  (highest priority)
    └────┬─────┘    └───────────┘
         │
    ┌────▼──────────┐    ┌──────────────┐
    │ CUSTOM BLOCK  │───▶│ 🚫 BLOCKED  │
    └────┬──────────┘    └──────────────┘
         │
         ▼ for each domain level
  ┌──────────────┐
  │ BLOOM FILTER │──── "definitely NOT" ──▶ skip, try next level
  │  (Layer 1)   │
  │  ~6KB, O(1)  │──── "MAYBE yes" ───┐
  └──────────────┘                     │
                                       ▼
                                ┌──────────────┐
                                │   HASH SET   │──── match ──▶ 🚫 DISPOSABLE
                                │  (Layer 2)   │
                                │   O(1)       │──── no match ──▶ next level (bloom FP)
                                └──────────────┘
```

### Why 2 tiers?

| Aspect             | Bloom Only    | HashSet Only | **Bloom + HashSet** |
| ------------------ | ------------- | ------------ | ------------------- |
| Memory             | ~6 KB         | ~350 KB      | ~356 KB             |
| False Positives    | ~1%           | None         | **None**            |
| False Negatives    | Never         | Never        | **Never**           |
| Speed (not found)  | Fastest       | Fast         | **Fastest** ⚡      |

The Bloom filter acts as a fast rejection gate — if it says "definitely not disposable", we skip the HashSet entirely. Only uncertain cases (~1%) proceed to exact matching.

---

## 📖 API Reference

### `isDisposable(email: string): ValidationResult`

Quick check using a singleton validator with default settings.

### `isTemp(email: string): boolean`

Returns `true` if the email is disposable. Convenience wrapper.

### `new EmailValidator(options?)`

| Option             | Type       | Default      | Description                            |
| ------------------ | ---------- | ------------ | -------------------------------------- |
| `customBlocklist`  | `string[]` | `[]`         | Additional domains to block            |
| `customAllowlist`  | `string[]` | `[]`         | Domains to always allow                |
| `autoUpdate`       | `boolean`  | `false`      | Enable periodic remote refresh         |
| `updateInterval`   | `number`   | `86400000`   | Refresh interval in ms (default: 24h)  |
| `updateUrl`        | `string`   | GitHub URL   | Custom URL for domain list             |
| `falsePositiveRate`| `number`   | `0.01`       | Bloom filter FPR (0.01 = 1%)           |
| `logging`          | `object`   | `undefined`  | Logging config (see below)             |

### `validator.check(email): ValidationResult`

```typescript
interface ValidationResult {
  disposable: boolean;
  email: string;
  domain: string;
  reason:
    | 'blocklist'         // Matched main disposable list
    | 'subdomain_match'   // Parent domain matched
    | 'custom_blocklist'  // Matched user's custom blocklist
    | 'allowlist'         // Overridden by custom allowlist
    | 'not_found'         // Not in any blocklist
    | 'invalid_email';    // Malformed email address
  matchedDomain?: string; // The domain that triggered the match
}
```

### `validator.checkMany(emails): ValidationResult[]`

Batch check multiple emails.

### `validator.refresh(): Promise<void>`

Manually fetch the latest domain list and rebuild the filter.

### `validator.stats(): ValidatorStats`

Returns statistics about the validator's current state.

### `validator.destroy(): void`

Clean up resources (stops auto-update timer).

---

## 🔍 Subdomain Detection

Subdomain bypass is a common attack vector. `tempmail-checker` walks the entire domain hierarchy:

```typescript
import { isDisposable } from 'tempmail-checker';

// All of these are caught:
isDisposable('user@mailinator.com');           // ✅ blocklist
isDisposable('user@mail.mailinator.com');       // ✅ subdomain_match
isDisposable('user@a.b.c.mailinator.com');      // ✅ subdomain_match
```

Multi-part TLDs (`.co.uk`, `.com.au`) are handled correctly — we never falsely match bare TLDs.

---

## 🔄 Auto-Updating

```typescript
const validator = new EmailValidator({
  autoUpdate: true,
  updateInterval: 12 * 60 * 60 * 1000, // every 12 hours
});

// Or manually refresh
await validator.refresh();

// Don't forget to clean up
validator.destroy();
```

The domain list is sourced from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains), which is actively maintained.

---

## 🧰 Advanced Usage

### Custom Blocklist & Allowlist

```typescript
const validator = new EmailValidator({
  customBlocklist: ['internal-spam.com', 'known-bad.org'],
  customAllowlist: ['mailinator.com'], // Override if you need to
});
```

**Priority order:** Allowlist > Custom Blocklist > Default Blocklist

### Direct Bloom Filter Access

```typescript
import { BloomFilter } from 'tempmail-checker';

const filter = BloomFilter.create(1000, 0.01);
filter.add('example.com');
filter.test('example.com'); // true (definitely or maybe)
filter.test('other.com');   // false (definitely not)
```

### Utility Functions

```typescript
import { parseEmail, getDomainLevels } from 'tempmail-checker';

parseEmail('user@mail.example.com');
// { local: 'user', domain: 'mail.example.com' }

getDomainLevels('mail.example.com');
// ['mail.example.com', 'example.com']
```

---

## 🪵 Configurable Logging & Debugging

Logging is **silent by default** — opt-in via options or environment variable.

### Via Options

```typescript
import { EmailValidator } from 'tempmail-checker';

const validator = new EmailValidator({
  logging: {
    level: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'silent'
    prefix: '[my-app]', // custom prefix (default: '[tempmail-checker]')
  },
});

validator.check('user@mailinator.com');
// [my-app] DEBUG Checking email { email: 'user@mailinator.com', domain: 'mailinator.com', levels: 1 }
// [my-app] INFO Disposable email detected { email: 'user@mailinator.com', matchedDomain: 'mailinator.com', reason: 'blocklist' }
```

### Via Environment Variable

```bash
TEMPMAIL_LOG_LEVEL=debug node your-app.js
```

### Custom Log Handler

```typescript
import { EmailValidator } from 'tempmail-checker';

const validator = new EmailValidator({
  logging: {
    level: 'info',
    handler: (level, message, meta) => {
      // Send to your logging system (Winston, Pino, etc.)
      myLogger[level](message, meta);
    },
  },
});
```

### Standalone Logger

```typescript
import { createLogger } from 'tempmail-checker';

const logger = createLogger({ level: 'debug' });
logger.debug('Custom message', { key: 'value' });
logger.setLevel('warn'); // change at runtime
```

---

## 🔌 Framework Middleware

### Express

```typescript
import express from 'express';
import { createExpressMiddleware } from 'tempmail-checker/middleware/express';

const app = express();
app.use(express.json());

// Block disposable emails on registration
app.post('/register',
  createExpressMiddleware({
    emailFields: ['body.email'],      // where to find the email (dot notation)
    blockDisposable: true,            // block with 422 (default)
    errorMessage: 'Please use a real email address.',
    errorStatusCode: 422,
  }),
  (req, res) => {
    res.json({ message: 'Registered!' });
  }
);

// Or just attach results without blocking
app.post('/check',
  createExpressMiddleware({ blockDisposable: false }),
  (req, res) => {
    res.json({ validation: req.emailValidation });
  }
);
```

#### Express Middleware Options

| Option             | Type       | Default                                        | Description                                |
| ------------------ | ---------- | ---------------------------------------------- | ------------------------------------------ |
| `emailFields`      | `string[]` | `['body.email']`                               | Dot-notation paths to email fields         |
| `blockDisposable`  | `boolean`  | `true`                                         | Block request if disposable email found    |
| `errorMessage`     | `string`   | `'Disposable email addresses are not allowed.'`| Error message in the response              |
| `errorStatusCode`  | `number`   | `422`                                          | HTTP status code for blocked requests      |
| All `ValidatorOptions` are also supported (customBlocklist, customAllowlist, logging, etc.) |

### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyTempmail } from 'tempmail-checker/middleware/fastify';

const app = Fastify();

app.register(fastifyTempmail, {
  emailFields: ['body.email'],
  blockDisposable: true,
  errorMessage: 'Disposable emails not allowed.',
});

app.post('/register', async (req, reply) => {
  // If we reach here, the email is not disposable
  return { message: 'Registered!' };
});

// Access validation results
app.post('/check', {
  preHandler: [],  // plugin hooks run automatically
}, async (req) => {
  return { validation: req.emailValidation };
});
```

---

## 📊 Performance

```
✅ 10,000 email checks: < 50ms
✅ Bloom filter lookup: O(1)
✅ HashSet lookup: O(1)
✅ Memory footprint: ~356 KB
✅ Package size: ~93 KB (minified)
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone the repo
git clone https://github.com/Eahtasham/tempmail-checker.git
cd tempmail-checker

# Install dependencies
npm install

# Generate domain data
npm run build:data

# Run tests
npm test

# Build
npm run build
```

---

## 📃 License

[MIT](LICENSE) © tempmail-checker contributors

---

## 🙏 Credits

- Domain list: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
- TLD parsing: [tldts](https://github.com/nicedoc/tldts)
