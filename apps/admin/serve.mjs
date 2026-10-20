import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist', import.meta.url));
const port = Number(process.env.PORT || 8080);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function insideRoot(file) {
  const resolved = normalize(file);
  return resolved === root || resolved.startsWith(root + sep);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);

  if (pathname === '/healthz') {
    send(res, 200, 'ok', { 'content-type': 'text/plain' });
    return;
  }

  if (pathname.includes('\0')) {
    send(res, 400, 'bad request');
    return;
  }

  const relative = pathname.replace(/^\/+/, '');
  let file = join(root, relative);
  if (!insideRoot(file)) {
    send(res, 400, 'bad request');
    return;
  }

  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html');
  }

  const asset = existsSync(file) && statSync(file).isFile();
  if (!asset) file = join(root, 'index.html');
  if (!existsSync(file)) {
    send(res, 404, 'not found');
    return;
  }

  const ext = extname(file);
  res.writeHead(200, {
    'content-type': types[ext] || 'application/octet-stream',
    'cache-control':
      asset && ext !== '.html'
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`admin listening on 0.0.0.0:${port}`);
});
