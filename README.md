<div align="center">

  <img src="public/wallpaper.png" alt="Swades Connect Banner" width="100%" />

  <br/>
  <br/>

  <h1>Swades Connect - Odoo CRM Extractor</h1>

</div>

A Chrome extension (Manifest V3) that extracts contacts, opportunities and activities from Odoo CRM.
It stores them in `chrome.storage.local` and shows them in a React popup where you can search, delete and export them.

[![CI](https://github.com/heyitsgautham/swades-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/heyitsgautham/swades-connect/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)

## Demo video

[Watch the demo video](https://youtu.be/Byhxi2gPe-w).
It shows extraction from a live Odoo CRM, data surviving a page refresh, the popup dashboard, and delete and export.

## Features

| Area | What it does |
|---|---|
| Extraction | Reads contacts, opportunities and activities from Odoo list and kanban views, across every pager page |
| RPC sync | Optionally watches Odoo's own `call_kw` traffic and applies creates, edits and deletes as they happen |
| Storage | Keeps records in `chrome.storage.local`, merged by id, with a lock so two tabs cannot overwrite each other |
| Popup | Tabs per record type with search, filters, per-record delete, delete all, and CSV or JSON export |
| Page indicator | A Shadow DOM status pill on the Odoo page shows idle, extracting, success and error states without touching Odoo's CSS |

## Requirements

| Tool | Version |
|---|---|
| Node.js | 20 or newer (CI uses 22) |
| pnpm | 10.26.2, pinned in `package.json` as `packageManager`; `corepack enable` installs it |
| Chrome | Any current version, with developer mode on for unpacked extensions |

No environment variables are read anywhere in the code, so there is no `.env` file.

## Install and build

```bash
git clone https://github.com/heyitsgautham/swades-connect.git
cd swades-connect
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

Then load it in Chrome.

1. Open `chrome://extensions/`.
2. Turn on Developer mode.
3. Click Load unpacked and pick the `dist/` folder.

`pnpm run dev` runs Vite with the CRXJS plugin, which rebuilds `dist/` and reloads the extension as you edit.

## Verify the setup

From a fresh clone, these commands must all exit with code 0.

```bash
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` runs lint, the Prettier check, typecheck, the test suite with coverage, and the production build, in the same order as CI.

`pnpm run fresh-check` deletes `node_modules`, `dist` and `coverage` first, then runs both commands, so a working tree behaves like a fresh clone.
It exited with code 0 in 55 seconds on macOS with Node 26 and pnpm 10.26.2.
For a run with no local state at all, `docker build --target check .` installs into a clean `node:22-alpine` image with no pnpm cache and runs `pnpm run check`.
CI's Docker build job runs that same target on every push.

## Commands

| Command | What it runs |
|---|---|
| `pnpm run dev` | Vite dev build with extension hot reload |
| `pnpm run build` | `tsc -b` then the production build into `dist/` |
| `pnpm run lint` | ESLint over the repo |
| `pnpm run format` | Prettier, rewriting files in place |
| `pnpm run format:check` | Prettier, failing on unformatted files |
| `pnpm run typecheck` | `tsc -b` with no emit |
| `pnpm test` | Vitest in watch mode |
| `pnpm run test:run` | The test suite once |
| `pnpm run test:coverage` | The test suite once with V8 coverage; fails below the thresholds in `vitest.config.ts` |
| `pnpm run test:e2e` | Playwright end-to-end tests against the built `dist/`; run `pnpm run build` first |
| `pnpm run check` | lint, format:check, typecheck, test:coverage and build in sequence |
| `pnpm run fresh-check` | Deletes `node_modules`, `dist` and `coverage`, reinstalls from the lockfile, then runs `check` |

## Testing

Tests use Vitest under jsdom and live next to the code in `__tests__/` folders.

| Piece | Where | Purpose |
|---|---|---|
| Chrome mock | `src/test/chromeMock.ts` | In-memory `chrome.storage.local` and `session` that clone values like the real API, plus `runtime`, `tabs` and `action` spies; `src/test/setup.ts` installs a fresh one before every test |
| Record fixtures | `src/test/fixtures.ts` | Synthetic contacts, opportunities and activities on `example.com` addresses |
| Odoo markup builders | `src/test/odooDom.ts` | Small list and kanban fragments with only the selectors the extractors read |
| Popup backend | `src/test/popupBackend.ts` | Answers the popup's `GET_DATA`, `DELETE_RECORD`, `DELETE_ALL_RECORDS` and `EXTRACT_DATA` messages from in-memory records, on a later task as Chrome does |

All test data is invented.
The unit tests never read the saved pages under `odoo-html/`; only the end-to-end tests below do.

Popup specs render the real components with React Testing Library and drive them with `user-event`, the way a user clicks and types.

Coverage covers every file under `src/`, the React popup included, except tests, test helpers and `src/popup/main.tsx`.
CI fails if it drops below 80% of statements and lines, 85% of functions or 75% of branches.

### End-to-end tests

`e2e/` loads the built `dist/` as an unpacked extension in headless Chromium through Playwright.
A small HTTPS server serves the saved pages in `odoo-html/` as `demo.odoo.com`, with a self-signed certificate made by `openssl` for the run, because the manifest only matches `https://*.odoo.com/*`.
The specs extract from each saved list and kanban page and check the records the service worker stores, then drive the real popup to delete a contact and flip a Settings switch.

```bash
pnpm exec playwright install chromium   # once
pnpm run build
pnpm run test:e2e
```

CI runs them in their own job on every push.

## Docker

The extension runs inside Chrome, so the container is a reproducible build and test environment, not a server.

```bash
docker compose run --rm check     # the full pnpm run check sequence
docker compose run --rm build     # writes the unpacked extension to ./dist
docker build --target extension -o out .   # same result without compose
```

CI builds both Docker targets on every push.

## Configuration

The extension keeps its settings in `chrome.storage.local`.

| Key | Set by | Effect |
|---|---|---|
| `auto_extract_enabled` | Popup settings | Re-extracts when data rows change on the page |
| `rpc_sync_enabled` | Popup settings | Applies Odoo RPC creates, edits and deletes as they happen |
| `log_level` | You, from the service worker console | `debug`, `info` (default), `warn` or `error` |
| `log_format` | You, from any extension console | `text` (default) prints `[Swades Connect:<scope>] message` with the context as a second argument; `json` prints one `{ ts, level, scope, message, context }` object per line |

To see the per-message traces, run this in the service worker console.

```js
chrome.storage.local.set({ log_level: 'debug' })
```

For logs you can filter or attach to a bug report, switch to JSON lines.
The service worker, the content script and the popup all follow the change without a reload.

```js
chrome.storage.local.set({ log_format: 'json' })
```

## Usage

1. Open your Odoo instance and log in.
2. Go to Contacts, CRM pipeline or Activities, in list or kanban view.
3. Click the Swades Connect toolbar icon, then Extract.
4. Watch the status pill on the page; extraction walks every pager page.
5. Browse the records in the popup tabs, search or filter, and export to CSV or JSON.

Host permissions cover `https://*.odoo.com/*` and local `file://` pages.

## Architecture

```
src/
├── background/               service worker
│   ├── index.ts              wires chrome listeners to the router
│   ├── router.ts             validates each message with zod, then dispatches
│   ├── broadcast.ts          sends STORAGE_UPDATED to open popups
│   └── handlers/             extract.ts, data.ts, rpc.ts
├── content/                  content script, injected at document_start
│   ├── index.ts              injects the RPC interceptor, mounts the indicator, routes messages
│   ├── extraction.ts         paged extraction per model and auto-extract
│   ├── rpcSync.ts            turns intercepted RPC calls into upsert and delete messages
│   ├── odooRecords.ts        converts raw Odoo records to the storage types
│   ├── parsing.ts            text helpers: names, currency, dates, activity types, content hashes
│   ├── extractors/           one DOM extractor per record type
│   ├── pagination.ts         walks Odoo's pager
│   ├── idCache.ts            real Odoo ids captured from RPC, used by the extractors
│   ├── viewDetector.ts       list, kanban or form; which model
│   └── domWatcher.ts         MutationObserver behind auto-extract
├── injected/                 rpcInterceptor.ts helpers and the Shadow DOM indicator
├── popup/                    React dashboard, styled with Tailwind utility classes
│   ├── App.tsx               header, status bar, tabs and the Settings modal
│   ├── background.ts         popup requests to the service worker, replies checked with zod
│   ├── activeTab.ts          sends a message to the active tab without throwing on non-Odoo pages
│   ├── components/           tabs, ActivityCard, DataTable, TabControls, Settings, SyncToggle, Toast
│   └── hooks/                useStorage, useExtraction, useSyncPreference, useSort, useExport, useToast
├── shared/                   types, zod schemas, storage, lock, logger, errors, export
└── test/                     chrome mock, fixtures and Odoo markup builders
e2e/                          Playwright specs that load dist/ in Chromium against odoo-html/
public/
├── manifest.json             Manifest V3
└── rpc-interceptor.js        runs in the page and patches fetch and XMLHttpRequest
```

### Message flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Odoo page     │────▶│  RPC interceptor │────▶│  Content script │
│  (fetch/XHR)    │     │  (page context)  │     │  (postMessage)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │ chrome.runtime
                                                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │     Popup UI     │◀────│ Service worker  │
                        │  (React)         │     │ (chrome.storage)│
                        └──────────────────┘     └─────────────────┘
```

The service worker owns every write to stored records.
`src/shared/schemas.ts` defines a zod schema per message action.
The router answers `Unknown action` for anything it does not handle, and `Invalid <ACTION> message` with the failing field paths for a malformed message, before any handler runs.

| Action | Sender | Effect |
|---|---|---|
| `EXTRACT_DATA` | Popup | Forwarded to the active tab's content script |
| `EXTRACTION_COMPLETE` | Content script | Records merged into storage |
| `EXTRACTION_ERROR` | Content script | Logged |
| `GET_DATA` | Popup | Returns stored records |
| `SAVE_DATA` | Any | Merges records into storage |
| `DELETE_RECORD`, `DELETE_ALL_RECORDS` | Popup | Removes one record or a whole type |
| `UPDATE_BADGE` | Content script | Sets the toolbar badge |
| `ODOO_RPC_UPSERT`, `ODOO_RPC_DELETE` | Content script | Applies RPC sync changes |
| `STORAGE_UPDATED` | Service worker | Tells open popups to refresh |
| `TOGGLE_AUTO_EXTRACT`, `TOGGLE_RPC_SYNC` | Popup, to the content script | Start or stop each mode |

### Storage schema

```typescript
interface StorageSchema {
  odoo_data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number; // ms since epoch of the last write
  };
}

interface Contact {
  id: string; // contact_{res.partner id}
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
}

interface Opportunity {
  id: string; // opp_{crm.lead id}, or opp_{content hash} until the real id is known
  name: string;
  revenue: number;
  stage: string;
  probability: number; // 0 to 100
  closeDate: string;
}

interface Activity {
  id: string; // act_{mail.activity id}, or act_{content hash}
  type: 'call' | 'meeting' | 'todo' | 'email';
  summary: string;
  dueDate: string; // YYYY-MM-DD when Odoo exposes a date
  assignedTo: string;
  status: 'open' | 'done';
}
```

Writes merge by `id`.
On an update, empty incoming fields keep the stored value.
`upsertRecords`, `upsertUpgradingHashIds` and `deleteRecordsById` wait up to 5 seconds for a lock in `chrome.storage.session`, and throw a `StorageError` if it stays taken.

### Logging and errors

`src/shared/logger.ts` gives each module a scoped logger.
Lines look like `[Swades Connect:rpc] Upserted records from RPC` followed by a context object you can expand in DevTools.
`src/shared/errors.ts` holds tagged error classes, so callers can tell a storage failure from other errors without matching message text.

## DOM selection strategy

Extraction uses CSS selectors.
[src/content/extractors/README.md](src/content/extractors/README.md) lists every selector.

Odoo's OWL views use predictable classes, and each field cell carries a `name` attribute such as `td[name="email"]`, so selectors are short and stable.

| View | Container | Records |
|---|---|---|
| List | `.o_list_view` | `tr.o_data_row` |
| Kanban | `.o_kanban_view` | `article.o_kanban_record` |
| Activity | `.o_activity_view` | |
| Form | `.o_form_view` | |

| Field | List view | Kanban view |
|---|---|---|
| Contact name | `td[name="complete_name"]` | `main span.fw-bold.fs-5` |
| Email | `td[name="email"]` | `i.fa.fa-envelope` and its sibling span |
| Phone | `td[name="phone"]` | `i.fa.fa-phone` and its sibling span |
| Opportunity name | `td[name="name"]` | `:scope > span.fw-bold.fs-5` |
| Revenue | `td[name="expected_revenue"]` | `div.o_kanban_card_crm_lead_revenue` |
| Activity type | `td[name="activity_type_id"]` | `span.badge span` |

Before extracting, the content script waits for `.o_web_client` to render.
It then walks the pager from page one until the counter reaches the total.
Odoo's next button wraps from the last page to the first, so visited page ranges are tracked too.

### Record ids

1. Contacts take the real id from the avatar URL, `/web/image/res.partner/{id}/avatar_128`.
2. Opportunities and activities take real ids from `web_search_read` and `web_read_group` responses captured by the RPC interceptor.
3. Without a real id, the extractor hashes the record content with djb2, for example `opp_lnl5ct`.

When RPC sync later sees the real id for a hashed record, `upsertUpgradingHashIds` matches it by opportunity name or activity summary and swaps in the real id, so no duplicate appears.

## Extraction in detail

### RPC interception

`public/rpc-interceptor.js` runs in the page, patches `fetch` and `XMLHttpRequest`, and posts matching responses to the content script.

Intercepted endpoints are `/web/dataset/call_kw/{model}/{method}` and `/web/dataset/call_button/{model}/{method}`.
Monitored models are `res.partner`, `crm.lead`, `mail.activity` and `mail.activity.schedule`.

| Method | Meaning | What the extension does |
|---|---|---|
| `web_search_read` | List or kanban data loaded | Caches real ids and upserts the records |
| `web_read_group` | Grouped kanban loaded, such as the pipeline | Same, for opportunities |
| `create`, `web_save` | Record created or saved | Upserts the saved record; id-only results are merged with the submitted fields |
| `write` | Record edited | Ignored; the following `web_save` carries the full record |
| `unlink` | Record deleted | Deletes the stored record |
| `action_done` | Activity marked done | Deletes the activity |
| `name_create` | Quick-create from a relation field | Adds the contact |

The activity scheduling wizard, `mail.activity.schedule`, returns its own id rather than the activity id.
Its saves are skipped, and the `web_search_read` that follows brings the real record.

### Contacts

1. Rows are `tr.o_data_row` in list view and `article.o_kanban_record` in kanban view.
2. The id comes from the avatar URL; without one, the row index gives `contact_idx_{n}`.
3. `complete_name` may read "Company, Person", and is split when no company column exists.
4. Email, phone and country come from `data-tooltip` where present and cell text otherwise.

### Opportunities

1. The id cache is seeded from opportunities already stored under real ids.
2. List rows give name, revenue, stage, probability and deadline.
3. Kanban cards take their stage from the column header and their probability from the priority stars, 0, 33, 67 or 100.
4. The id comes from the cache by name, or a hash of name, stage and revenue.

### Activities

Activity summaries are not unique, so ids map by row position on the current page.
Odoo's default activity sort is not unique either, and rows can shift between pages.
Full-page extraction therefore uses the RPC records captured while paging, not the DOM rows.

### Edits and deletes

| Source | Path |
|---|---|
| Edit in Odoo | `web_save` reaches the content script, which sends `ODOO_RPC_UPSERT`; the service worker merges the fields |
| Delete in Odoo | `unlink` or `action_done` sends `ODOO_RPC_DELETE` with prefixed ids |
| Delete in the popup | `DELETE_RECORD` or `DELETE_ALL_RECORDS` |

A record stored under a hash id and deleted in Odoo before any edit cannot be matched, because the delete only carries the real id.
Re-extracting the page removes it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Contact

Gautham Krishna, [heyitsgautham@gmail.com](mailto:heyitsgautham@gmail.com).
