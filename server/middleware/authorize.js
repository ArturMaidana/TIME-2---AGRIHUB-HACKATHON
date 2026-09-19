import { readSession } from '../config/session-store.js';
import { json } from '../utils/http.js';

export function authorize(roles, controller) {
  return (request, response, context) => {
    const session = readSession(request, roles);
    if (!session) return json(response, 401, { error: 'Faça login novamente' });
    return controller(request, response, { ...context, session });
  };
}
