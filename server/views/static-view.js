import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { json } from '../utils/http.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
};

export async function renderStatic(response, url, distDirectory) {
  let filePath = resolve(distDirectory, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!filePath.startsWith(distDirectory)) return json(response, 403, { error: 'Acesso negado' });
  try {
    if (!(await stat(filePath)).isFile()) filePath = resolve(distDirectory, 'index.html');
  } catch {
    filePath = resolve(distDirectory, 'index.html');
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    json(response, 503, { error: 'Execute npm run build' });
  }
}
