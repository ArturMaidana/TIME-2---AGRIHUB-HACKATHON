import { AuthService } from '../services/auth-service.js';
import { json, parseBody } from '../utils/http.js';

export async function login(request, response) {
  const result = AuthService.authenticate(await parseBody(request));
  return result ? json(response, 200, result) : json(response, 401, { error: 'Código inválido' });
}
