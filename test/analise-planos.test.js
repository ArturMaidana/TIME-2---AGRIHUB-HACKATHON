import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarAnalise } from '../src/domain/analise-planos.js';

function base() {
  return {
    setorNome: 'Desossa', turnoNome: 'Manhã',
    historico: [
      { calculavel: true, score: 55, status: 'AMARELO', totalRespostas: 20, confiabilidade: 'ALTA' },
      { calculavel: true, score: 68, status: 'AMARELO', totalRespostas: 22, confiabilidade: 'ALTA' },
    ],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoFisicoPercentual: 0.2, variacaoFaltasPercentual: 0.18 },
    alertasAbertos: [{ regra: 'DESGASTE_E_FALTAS', motivo: 'Aumento simultâneo de desgaste e faltas' }],
    hr: { faltas: 6, afastamentos: 1 },
  };
}

test('produz os 7 elementos exigidos pelo spec', () => {
  const analise = gerarAnalise(base());
  assert.equal(typeof analise.resumo, 'string');
  assert.ok(analise.evidencias.length > 0);
  assert.ok(analise.correlacoes.length > 0);
  assert.ok(['BAIXA', 'MODERADA', 'ALTA'].includes(analise.nivelAtencao));
  assert.ok(analise.acoesSugeridas.length >= 1 && analise.acoesSugeridas.length <= 3);
  assert.ok(analise.indicadoresAcompanhar.length > 0);
  assert.match(analise.aviso, /apoia|apoio/i);
  assert.equal(analise.versaoMotor, 'v1');
});

test('correlações nunca afirmam causalidade', () => {
  const analise = gerarAnalise(base());
  for (const correlacao of analise.correlacoes) {
    assert.doesNotMatch(correlacao, /\bcausou\b|\bcausa\b|provocou|é resultado de/i);
  }
});

test('nível de atenção ALTA quando há alerta vermelho aberto', () => {
  const cenario = base();
  cenario.alertasAbertos = [{ regra: 'INDICE_VERMELHO', motivo: 'Índice em faixa vermelha' }];
  cenario.historico[0] = { calculavel: true, score: 40, status: 'VERMELHO', totalRespostas: 20, confiabilidade: 'ALTA' };
  const analise = gerarAnalise(cenario);
  assert.equal(analise.nivelAtencao, 'ALTA');
});

test('sem alertas e tendência de melhora, nível BAIXA', () => {
  const cenario = base();
  cenario.alertasAbertos = [];
  cenario.comparacao = { comparavel: true, tendencia: 'MELHORA', variacaoFisicoPercentual: -0.1, variacaoFaltasPercentual: -0.1 };
  cenario.historico = [
    { calculavel: true, score: 85, status: 'VERDE', totalRespostas: 20, confiabilidade: 'ALTA' },
    { calculavel: true, score: 78, status: 'VERDE', totalRespostas: 20, confiabilidade: 'ALTA' },
  ];
  const analise = gerarAnalise(cenario);
  assert.equal(analise.nivelAtencao, 'BAIXA');
});
