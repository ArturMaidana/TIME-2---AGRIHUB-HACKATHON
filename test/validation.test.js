import test from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, isNonNegativeInteger } from '../server/utils/validation.js';
import { HrService } from '../server/services/hr-service.js';

test('valida datas ISO usadas nos períodos do RH', () => {
  assert.equal(isIsoDate('2026-09-19'), true);
  assert.equal(isIsoDate('19/09/2026'), false);
  assert.equal(isIsoDate(''), false);
});

test('aceita somente contagens inteiras não negativas', () => {
  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isNonNegativeInteger('12'), true);
  assert.equal(isNonNegativeInteger(-1), false);
  assert.equal(isNonNegativeInteger(1.5), false);
});

test('rejeita indicador do RH fora do escopo da unidade', () => {
  assert.deepEqual(HrService.create('u1', {
    sectorId: 'setor-inexistente', shiftId: 't1', period: '2026-09-19',
    absences: 1, leaves: 0,
  }), { ok: false, error: 'Setor inválido' });
});
