import { TotemService } from '../services/totem-service.js';
import { json, parseBody } from '../utils/http.js';

export function getContext(_request, response, { session }) {
  json(response, 200, TotemService.getContext(session.unitId));
}

export async function recordResponses(request, response, { session }) {
  const result = TotemService.record(session.unitId, await parseBody(request));
  json(response, result.ok ? 201 : 422, result);
}
