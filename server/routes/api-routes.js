import { login } from '../controllers/auth-controller.js';
import { getDashboard } from '../controllers/dashboard-controller.js';
import { createIndicator } from '../controllers/hr-controller.js';
import { getMeta } from '../controllers/meta-controller.js';
import { getContext, recordResponses } from '../controllers/totem-controller.js';
import { authorize } from '../middleware/authorize.js';
import { asyncController, json } from '../utils/http.js';

const routes = new Map([
  ['POST /api/auth', login],
  ['GET /api/totem', authorize(['TOTEM'], getContext)],
  ['POST /api/totem/responses', authorize(['TOTEM'], recordResponses)],
  ['GET /api/meta', authorize(['SUPERVISOR', 'RH'], getMeta)],
  ['GET /api/dashboard', authorize(['SUPERVISOR', 'RH'], getDashboard)],
  ['POST /api/hr', authorize(['RH'], createIndicator)],
]);

export async function handleApi(request, response, url) {
  const controller = routes.get(`${request.method} ${url.pathname}`);
  if (!controller) return json(response, 404, { error: 'Rota não encontrada' });
  return asyncController(controller)(request, response, { url });
}
