import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

/** The host the extension's content script matches, mapped to this server by Chromium's host resolver. */
export const ODOO_HOST = 'demo.odoo.com';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

export interface OdooServer {
  origin: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Serve the saved pages in odoo-html/ over HTTPS on 127.0.0.1.
 * The manifest only matches https://*.odoo.com/*, so the pages need an odoo.com origin and TLS.
 * The certificate is self-signed, made with openssl for this run, and deleted on close.
 */
export async function startOdooServer(root = 'odoo-html'): Promise<OdooServer> {
  const certDir = mkdtempSync(join(tmpdir(), 'swades-e2e-cert-'));
  const key = join(certDir, 'key.pem');
  const cert = join(certDir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      `/CN=${ODOO_HOST}`,
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  );

  const server: Server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'https://x').pathname)).replace(
      /^(\.\.[/\\])+/,
      '',
    );
    try {
      const body = readFileSync(join(root, path));
      response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    origin: `https://${ODOO_HOST}:${port}`,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        rmSync(certDir, { recursive: true, force: true });
      }),
  };
}
