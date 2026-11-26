import * as fs from 'node:fs';
import * as path from 'node:path';
import { seedIfNeeded } from './db';
import { CORS_HEADERS, handleApiRequest } from './routes';

const PORT = Number(process.env.PORT ?? 3001);
const DIST_WEB_DIR = path.join(process.cwd(), 'dist', 'web');
const PUBLIC_DIR = path.join(process.cwd(), 'web', 'public');
const WEB_INDEX = path.join(process.cwd(), 'web', 'index.html');

seedIfNeeded();

function resolveStaticFile(pathname: string): string | null {
  const cleanRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (cleanRel.includes('..')) return null;

  const candidates = [
    path.join(DIST_WEB_DIR, cleanRel),
    path.join(PUBLIC_DIR, cleanRel),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  return null;
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 240,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle API routes
    if (url.pathname.startsWith('/api')) {
      try {
        const apiRes = await handleApiRequest(req, url);
        if (apiRes) return apiRes;
      } catch (err: any) {
        console.error('[API Error]', url.pathname, err);
        return new Response(
          JSON.stringify({ error: err?.message || 'Erro interno do servidor.' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              ...CORS_HEADERS,
            },
          },
        );
      }
    }

    // Serve static files from dist/web/ and web/public/
    const staticPath = resolveStaticFile(url.pathname);
    if (staticPath) {
      const file = Bun.file(staticPath);
      return new Response(file, {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': staticPath.includes(`${path.sep}assets${path.sep}`)
            ? 'public, max-age=3600'
            : 'no-cache',
        },
      });
    }

    // SPA fallback to dist/web/index.html or web/index.html
    const distIndex = path.join(DIST_WEB_DIR, 'index.html');
    const fallbackIndex = fs.existsSync(distIndex) ? distIndex : WEB_INDEX;
    if (fs.existsSync(fallbackIndex)) {
      return new Response(Bun.file(fallbackIndex), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...CORS_HEADERS,
        },
      });
    }

    return new Response('MighT API Server running. Run `bun run build` for web assets.', {
      status: 200,
      headers: CORS_HEADERS,
    });
  },
});

console.log(`MighT server listening on http://localhost:${server.port}`);
