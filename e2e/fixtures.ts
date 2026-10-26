import { chromium, expect, test as base, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'node:path';
import { ODOO_HOST, startOdooServer, type OdooServer } from './odooServer';

interface Fixtures {
  extension: { context: BrowserContext; serviceWorker: Worker; id: string };
}

interface WorkerFixtures {
  odoo: OdooServer;
}

/** Load the built dist/ as an unpacked extension in a fresh Chromium profile for each test. */
export const test = base.extend<Fixtures, WorkerFixtures>({
  odoo: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await startOdooServer();
      await use(server);
      await server.close();
    },
    { scope: 'worker' },
  ],

  // eslint-disable-next-line no-empty-pattern
  extension: async ({}, use) => {
    const dist = resolve('dist');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      ignoreHTTPSErrors: true,
      args: [
        `--disable-extensions-except=${dist}`,
        `--load-extension=${dist}`,
        `--host-resolver-rules=MAP ${ODOO_HOST} 127.0.0.1`,
        '--ignore-certificate-errors',
      ],
    });
    const serviceWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use({ context, serviceWorker, id: new URL(serviceWorker.url()).host });
    await context.close();
  },
});

export { expect };
