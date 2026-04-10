# Contributing to tempmail-checker

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Eahtasham/tempmail-checker.git
cd tempmail-checker

# Install dependencies
npm install

# Generate domain data (fetches from GitHub)
npm run build:data

# Run tests
npm test

# Build the package
npm run build
```

## Project Structure

```
src/
├── index.ts           # Public API exports
├── types.ts           # TypeScript interfaces
├── hash.ts            # MurmurHash3 implementation
├── bloom-filter.ts    # Bloom filter data structure
├── email-parser.ts    # Email parsing & validation
├── subdomain.ts       # Domain hierarchy walker
├── validator.ts       # Main EmailValidator class
├── check.ts           # Simple functional API
├── updater.ts         # Runtime list refresh
└── data/
    ├── domains.ts     # Auto-generated domain list
    └── bloom-data.ts  # Auto-generated bloom filter

tests/                 # Test files (vitest)
scripts/               # Build scripts
.github/workflows/     # CI/CD pipelines
```

## Making Changes

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/my-feature`
3. **Make your changes** with clear, descriptive commits
4. **Add tests** for any new functionality
5. **Run the test suite**: `npm test`
6. **Run type checking**: `npm run lint`
7. **Submit a Pull Request** against `main`

## Code Style

- We use **Prettier** for formatting. Run `npm run format` before committing.
- **TypeScript strict mode** is enabled. All code must pass type checking.
- Write **JSDoc comments** for all public APIs.
- Keep functions focused and files small.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

When adding tests:
- Place test files in `tests/` with the `.test.ts` extension
- Test both success and failure cases
- Test edge cases and boundary conditions

## Updating the Domain List

The domain list is automatically updated weekly via GitHub Actions. To manually update:

```bash
npm run build:data
```

This fetches the latest list from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) and regenerates `src/data/domains.ts` and `src/data/bloom-data.ts`.

## Releasing

Releases are handled via GitHub Releases. When a release is published, the npm package is automatically published via GitHub Actions.

1. Update the version in `package.json`
2. Commit and push to `main`
3. Create a GitHub Release with a tag matching the version (e.g., `v1.0.1`)
4. The publish workflow will automatically build, test, and publish to npm

## Reporting Issues

- Use **GitHub Issues** for bug reports and feature requests
- Include a clear description and reproduction steps
- For bugs, include your Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
