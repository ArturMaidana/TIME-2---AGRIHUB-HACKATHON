import test from 'node:test';
import assert from 'node:assert/strict';
import { IndiceSetorService } from '../server/services/indice-setor-service.js';
import { IndiceSetorModel } from '../server/models/indice-setor-model.js';
import { dateKey } from '../server/utils/date.js';

test('calcula e armazena o índice diário de um setor com amostra do seed', async () => {
  const hoje = dateKey();
  const row = await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's1', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  assert.equal(row.unidade_id, 'u1');
  assert.ok(['INCONCLUSIVO', 'BAIXA', 'ALTA'].includes(row.confiabilidade));

  const stored = await IndiceSetorModel.find({
    unidadeId: 'u1', setorId: 's1', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  assert.equal(stored.id, row.id);
});

test('recalcular o mesmo escopo faz upsert (não duplica linha)', async () => {
  const hoje = dateKey();
  await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  const second = await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  const history = await IndiceSetorModel.listHistory({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO',
  });
  assert.equal(history.filter((row) => row.data_periodo === hoje).length, 1);
  assert.equal(second.confiabilidade, second.confiabilidade);
});
