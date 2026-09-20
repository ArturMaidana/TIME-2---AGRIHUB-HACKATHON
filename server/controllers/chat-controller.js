import { ChatService } from '../services/chat-service.js';
import { json, parseBody } from '../utils/http.js';

export async function getContexto(_request, response, { session }) {
  json(response, 200, await ChatService.getContexto(session.unitId));
}

export async function listMinhasMensagens(_request, response, { session }) {
  json(response, 200, { mensagens: await ChatService.minhasMensagens(session.userId) });
}

export async function criarMensagem(request, response, { session }) {
  const result = await ChatService.enviar(session.unitId, session.userId, await parseBody(request));
  json(response, result.ok ? 201 : 422, result);
}
