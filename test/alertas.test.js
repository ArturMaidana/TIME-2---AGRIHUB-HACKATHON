import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarAlerta, deveEscalar } from '../src/domain/alertas.js';

test('vermelho escala imediatamente', () => {
  assert.deepEqual(avaliarAlerta({ indices: [{ data: '2026-09-19', score: 49 }] }), {
    nivel: 'VERMELHO',
    status: 'ESCALADO',
    dataReferencia: '2026-09-19',
  });
});

test('amarelo exige dias consecutivos', () => {
  const alerta = avaliarAlerta({
    indices: [
      { data: '2026-09-18', score: 65 },
      { data: '2026-09-19', score: 62 },
    ],
  });
  assert.equal(alerta?.nivel, 'AMARELO');
  assert.equal(alerta?.status, 'ABERTO');

  assert.equal(
    avaliarAlerta({
      indices: [
        { data: '2026-09-17', score: 65 },
        { data: '2026-09-19', score: 62 },
      ],
    }),
    null,
  );
});

test('não duplica alerta ativo', () => {
  assert.equal(
    avaliarAlerta({ indices: [{ data: '2026-09-19', score: 10 }], alertaAtivo: true }),
    null,
  );
});

test('escalona somente estados pendentes depois do prazo', () => {
  const base = {
    geradoEm: '2026-09-17T10:00:00Z',
    agora: '2026-09-19T11:00:00Z',
  };
  assert.equal(deveEscalar({ ...base, status: 'ABERTO' }), true);
  assert.equal(deveEscalar({ ...base, status: 'TRATADO' }), false);
});
