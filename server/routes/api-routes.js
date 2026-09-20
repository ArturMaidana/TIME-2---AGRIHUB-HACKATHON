import { login } from '../controllers/auth-controller.js';
import { getDashboard } from '../controllers/dashboard-controller.js';
import { createIndicator } from '../controllers/hr-controller.js';
import { getHealth } from '../controllers/health-controller.js';
import { getMeta } from '../controllers/meta-controller.js';
import { getContext, recordResponses } from '../controllers/totem-controller.js';
import {
  getIndices, getComparativo, getParticipacao, getAlertas, patchAlerta,
  getAnalises, getPlanosAcao, patchPlanoAcao, getNotificacoes, patchNotificacao,
} from '../controllers/supervisor-controller.js';
import { getContexto, listMinhasMensagens, criarMensagem } from '../controllers/chat-controller.js';
import { authorize } from '../middleware/authorize.js';
import { asyncController, json } from '../utils/http.js';

const routes = new Map([
  ['GET /api/health', getHealth],
  ['POST /api/auth', login],
  ['GET /api/totem', authorize(['TOTEM'], getContext)],
  ['POST /api/totem/responses', authorize(['TOTEM'], recordResponses)],
  ['GET /api/meta', authorize(['SUPERVISOR', 'RH'], getMeta)],
  ['GET /api/dashboard', authorize(['SUPERVISOR', 'RH'], getDashboard)],
  ['POST /api/hr', authorize(['RH'], createIndicator)],
  ['GET /api/v1/supervisor/indices', authorize(['SUPERVISOR'], getIndices)],
  ['GET /api/v1/supervisor/comparativo', authorize(['SUPERVISOR'], getComparativo)],
  ['GET /api/v1/supervisor/participacao', authorize(['SUPERVISOR'], getParticipacao)],
  ['GET /api/v1/supervisor/alertas', authorize(['SUPERVISOR'], getAlertas)],
  ['GET /api/v1/supervisor/analises', authorize(['SUPERVISOR'], getAnalises)],
  ['GET /api/v1/supervisor/planos-acao', authorize(['SUPERVISOR'], getPlanosAcao)],
  ['GET /api/v1/supervisor/notificacoes', authorize(['SUPERVISOR'], getNotificacoes)],
  ['GET /api/chat/contexto', authorize(['FUNCIONARIO'], getContexto)],
  ['GET /api/chat/mensagens', authorize(['FUNCIONARIO'], listMinhasMensagens)],
  ['POST /api/chat/mensagens', authorize(['FUNCIONARIO'], criarMensagem)],
]);

export async function handleApi(request, response, url) {
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/alertas/')) {
    return asyncController(authorize(['SUPERVISOR'], patchAlerta))(request, response, { url });
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/planos-acao/')) {
    return asyncController(authorize(['SUPERVISOR'], patchPlanoAcao))(request, response, { url });
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/notificacoes/')) {
    return asyncController(authorize(['SUPERVISOR'], patchNotificacao))(request, response, { url });
  }
  const controller = routes.get(`${request.method} ${url.pathname}`);
  if (!controller) return json(response, 404, { error: 'Rota não encontrada' });
  return asyncController(controller)(request, response, { url });
}
