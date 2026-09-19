import { json } from '../utils/http.js';

export function getHealth(_request, response) {
  json(response, 200, {
    status: 'ok',
    service: 'agrihub-api',
    timestamp: new Date().toISOString(),
  });
}
