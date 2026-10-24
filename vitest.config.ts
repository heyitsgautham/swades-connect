import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts so the CRX plugin does not run under test.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/shared/**/*.ts', 'src/content/**/*.ts', 'src/background/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/test/**'],
    },
  },
});
