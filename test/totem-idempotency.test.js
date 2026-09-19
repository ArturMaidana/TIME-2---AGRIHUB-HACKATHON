import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TotemService } from '../server/services/totem-service.js';
import { ResponseModel } from '../server/models/response-model.js';

test('reenviar a mesma idempotency key não duplica os contadores', async () => {
  const key = randomUUID();
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's1').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  const answers = { ENERGY: 4, PHYSICAL: 2, STRESS: 2 };
  const first = await TotemService.record('u1', { sectorId: 's1', answers, idempotencyKey: key });
  const second = await TotemService.record('u1', { sectorId: 's1', answers, idempotencyKey: key });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's1').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 3);
});

test('duas tentativas com chaves diferentes incrementam normalmente', async () => {
  const answers = { ENERGY: 3, PHYSICAL: 3, STRESS: 3 };
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's2').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  await TotemService.record('u1', { sectorId: 's2', answers, idempotencyKey: randomUUID() });
  await TotemService.record('u1', { sectorId: 's2', answers, idempotencyKey: randomUUID() });

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's2').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 6);
});
