import { handleApi } from '../server/routes/api-routes.js';

export default async function handler(request, response) {
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost';
  const url = new URL(request.url, `${protocol}://${host}`);
  
  return handleApi(request, response, url);
}
