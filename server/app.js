import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './routes/api-routes.js';
import { renderStatic } from './views/static-view.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(root, 'dist');

export async function app(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  return url.pathname.startsWith('/api/')
    ? handleApi(request, response, url)
    : renderStatic(response, url, distDirectory);
}
