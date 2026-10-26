# Contributing

## Set up

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` must exit with code 0 before you open a pull request.
CI runs the same steps, plus `pnpm audit`, a gitleaks scan of the history, and a Docker build.

## Work on the extension

1. Run `pnpm run dev`.
2. Load `dist/` with Load unpacked on `chrome://extensions/`.
3. Open an Odoo list or kanban view and use the popup.

To see debug logs, run `chrome.storage.local.set({ log_level: 'debug' })` in the service worker console.

## Tests

- Put specs in a `__tests__/` folder next to the module, named `<module>.test.ts`.
- Use the chrome mock from `src/test/chromeMock.ts`; `src/test/setup.ts` gives every test an empty one.
- Build Odoo markup with `src/test/odooDom.ts` and records with `src/test/fixtures.ts`.
- Test popup components with React Testing Library and `user-event`, and answer their messages with `installPopupBackend` from `src/test/popupBackend.ts`.
- Test data must be invented. Never paste a real Odoo page or a real person's contact details into a fixture.
- A bug fix lands with a test that fails without the fix.
- A change to extraction or to the popup should keep `pnpm run build && pnpm run test:e2e` passing; the saved pages in `odoo-html/` are its fixtures, and they hold placeholder data only.
- Coverage thresholds live in `vitest.config.ts`. Raise them when coverage grows; never lower them to make CI pass.

## Code

- TypeScript is strict. Avoid `any` and `as unknown as` casts; parse untrusted data with the zod schemas in `src/shared/schemas.ts`.
- Any new runtime message action needs a schema in `schemas.ts`, a handler, and a router test.
- Log through `createLogger(scope)` from `src/shared/logger.ts`, not `console`.
- Style popup components with Tailwind utility classes and the tokens in `src/popup/index.css`, such as `bg-primary`, `text-muted` and `border-border`. Use `hover:` and `active:` classes instead of mouse handlers, and keep inline `style` for values that come from data, such as a column width.
- Keep files under 500 lines. Split by responsibility when one grows past that.
- ESLint enforces the rules and Prettier the formatting. Run `pnpm run lint` and `pnpm run format`.

## Commits

Use conventional commits, `type(scope): subject`, for example `fix(opportunities): map three filled priority stars to 100 percent`.
Keep each commit to one change, and include the tests that prove it.
