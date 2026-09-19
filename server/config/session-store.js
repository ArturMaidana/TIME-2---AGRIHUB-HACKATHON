import { randomBytes } from 'node:crypto';

const sessions = new Map();

export function createSession(payload) {
  const token = randomBytes(24).toString('base64url');
  sessions.set(token, payload);
  return token;
}

export function readSession(request, allowedRoles) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? sessions.get(token) : null;
  return session && allowedRoles.includes(session.role) ? session : null;
}
