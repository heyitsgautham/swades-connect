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
      // Every source file, the React popup included. main.tsx only mounts <App /> into the page.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/test/**', 'src/popup/main.tsx', 'src/**/*.d.ts'],
      // CI fails below these. Raise them as coverage grows; never lower them to pass.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 85,
        lines: 80,
      },
    },
  },
});
