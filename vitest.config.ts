import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts so the CRX plugin does not run under test.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Extension logic only; the React popup is checked by lint, typecheck and build.
      include: ['src/shared/**/*.ts', 'src/content/**/*.ts', 'src/background/**/*.ts', 'src/injected/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/test/**'],
      // CI fails below these. Raise them as coverage grows; never lower them to pass.
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 75,
        lines: 75,
      },
    },
  },
});
