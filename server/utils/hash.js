import { createHash } from 'node:crypto';

export function hashObjetoEstavel(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}
