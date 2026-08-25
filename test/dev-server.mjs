import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const { default: handler } = await import('../api.js');
const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 4173);
const staticFiles = new Set([
  '/index.html',
  '/style.css',
  '/app.js',
  '/editorial-base.js',
  '/editorial-1.js',
  '/editorial-2.js',
  '/editorial-3.js',
  '/editorial-4.js',
  '/editorial-5.js',
  '/editorial-6.js',
  '/editorial-7.js',
  '/editorial-8.js',
  '/editorial-9.js',
  '/editorial-10.js',
  '/editorial-11.js',
  '/editorial-12.js',
  '/editorial-13.js',
  '/editorial-14.js',
  '/editorial-15.js',
  '/editorial-16.js',
  '/social/celebridades-cerveja.jpg',
]);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
};

async function bodyOf(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function apiResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(value) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
      return value;
    },
  };
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api') {
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method || '')
        ? await bodyOf(req)
        : undefined;
      await handler(
        {
          method: req.method,
          query: Object.fromEntries(url.searchParams),
          headers: req.headers,
          body,
        },
        apiResponse(res),
      );
      return;
    }

    const requested = staticFiles.has(url.pathname) ? url.pathname : '/index.html';
    const file = join(root, requested.slice(1));
    const content = await readFile(file);
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch (error) {
    console.error('Local server error', error);
    res.statusCode = 500;
    res.end('Local server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`TOPO local server: http://127.0.0.1:${port}`);
});
