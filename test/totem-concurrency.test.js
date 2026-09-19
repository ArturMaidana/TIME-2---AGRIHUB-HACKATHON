import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TotemService } from '../server/services/totem-service.js';
import { ResponseModel } from '../server/models/response-model.js';

test('20 envios simultâneos ao mesmo setor não perdem incrementos', async () => {
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's3').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  const answers = { ENERGY: 5, PHYSICAL: 1, STRESS: 1 };
  await Promise.all(Array.from({ length: 20 }, () =>
    TotemService.record('u1', { sectorId: 's3', answers, idempotencyKey: randomUUID() })));

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's3').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 60);
});
