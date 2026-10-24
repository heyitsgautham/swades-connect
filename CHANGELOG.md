# Changelog

All notable changes to this project are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-25

### Added

- Vitest suite under jsdom with an in-memory chrome API mock and synthetic Odoo markup builders, covering storage, locking, every extractor, RPC sync, message routing and pagination.
- Coverage thresholds that fail the build below 75% of statements, functions and lines or 70% of branches.
- GitHub Actions CI running lint, typecheck, tests with coverage, the extension build, `pnpm audit`, a gitleaks scan and a Docker build.
- Dependabot updates for npm packages and GitHub Actions.
- zod schemas for every runtime message; the service worker and content script reject malformed messages before acting on them.
- A scoped, leveled logger whose level follows `log_level` in `chrome.storage.local`.
- `StorageError` for lock contention in storage writes.
- Dockerfile and docker-compose.yml for isolated checks and builds.
- `pnpm run check`, `pnpm run typecheck` and `pnpm run test:coverage` scripts.

### Changed

- Split the content script and the service worker into focused modules; `content/index.ts` went from about 1,000 lines to 74 and `background/index.ts` from 536 to 47.
- RPC-synced activities now map types with the same rules as DOM extraction.
- Opportunity and activity RPC upserts now wait for the storage lock instead of failing at once.
- Updated dependencies within their ranges and moved vitest to 4.1, clearing all `pnpm audit` advisories.

### Fixed

- Kanban opportunities with three priority stars stored a probability of 99 instead of 100.
- `extractionTimeMs` in extraction metadata held a timestamp instead of the elapsed time.

### Removed

- Vite starter files, the unused inline copy of the RPC interceptor, and unused message test helpers.

## 2026-01-17

Initial release of the extension: DOM extraction of contacts, opportunities and activities from list and kanban views, pagination, RPC interception for real-time sync, Shadow DOM status indicator, and the React popup with search, delete and CSV or JSON export.

[Unreleased]: https://github.com/heyitsgautham/swades-connect/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/heyitsgautham/swades-connect/releases/tag/v0.1.0
