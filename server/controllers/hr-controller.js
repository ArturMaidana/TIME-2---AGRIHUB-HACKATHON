import { HrService } from '../services/hr-service.js';
import { json, parseBody } from '../utils/http.js';

export async function createIndicator(request, response, { session }) {
  const result = HrService.create(session.unitId, await parseBody(request));
  json(response, result.ok ? 201 : 422, result);
}
