import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarAlertas } from '../src/domain/alertas.js';

const config = { limiarAmarelo: 50, limiarVerde: 70, diasConsecutivosAmarelo: 2, variacaoRelevantePercentual: 0.15, amostraMinima: 5 };

function indice(status, score, extra = {}) {
  return { calculavel: true, status, score, confiabilidade: 'ALTA', totalRespostas: 20, ...extra };
}

test('índice em vermelho dispara alerta vermelho', () => {
  const alertas = avaliarAlertas({ historico: [indice('VERMELHO', 40)], comparacao: { comparavel: false }, config });
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].nivel, 'VERMELHO');
  assert.equal(alertas[0].regra, 'INDICE_VERMELHO');
});

test('amarelo por dias consecutivos dispara, um único amarelo não dispara', () => {
  const umDia = avaliarAlertas({ historico: [indice('AMARELO', 60)], comparacao: { comparavel: false }, config });
  assert.equal(umDia.some((alerta) => alerta.regra === 'AMARELO_CONSECUTIVO'), false);

  const doisDias = avaliarAlertas({
    historico: [indice('AMARELO', 60), indice('AMARELO', 58)],
    comparacao: { comparavel: false },
    config,
  });
  assert.ok(doisDias.some((alerta) => alerta.regra === 'AMARELO_CONSECUTIVO'));
});

test('queda relevante de energia dispara alerta', () => {
  const alertas = avaliarAlertas({
    historico: [indice('VERDE', 75)],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoEnergiaPercentual: -0.2, variacaoFisicoPercentual: 0, variacaoEmocionalPercentual: 0, variacaoFaltasPercentual: 0, variacaoAfastamentosPercentual: 0 },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'QUEDA_ENERGIA'));
});

test('aumento simultâneo de desgaste e faltas dispara alerta combinado', () => {
  const alertas = avaliarAlertas({
    historico: [indice('AMARELO', 55)],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoEnergiaPercentual: 0, variacaoFisicoPercentual: 0.2, variacaoEmocionalPercentual: 0, variacaoFaltasPercentual: 0.25, variacaoAfastamentosPercentual: 0 },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'DESGASTE_E_FALTAS'));
});

test('amostra abaixo do mínimo dispara alerta de amostra reduzida', () => {
  const alertas = avaliarAlertas({
    historico: [{ calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 2 }],
    comparacao: { comparavel: false },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'AMOSTRA_REDUZIDA'));
});

test('sem gatilhos, não gera alerta', () => {
  const alertas = avaliarAlertas({ historico: [indice('VERDE', 90)], comparacao: { comparavel: true, tendencia: 'ESTAVEL' }, config });
  assert.deepEqual(alertas, []);
});
