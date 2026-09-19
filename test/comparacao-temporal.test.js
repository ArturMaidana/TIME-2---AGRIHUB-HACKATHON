import test from 'node:test';
import assert from 'node:assert/strict';
import { compararPeriodos } from '../src/domain/comparacao-temporal.js';

const config = { variacaoRelevantePercentual: 0.15 };

test('sem período anterior calculável, sinaliza amostra insuficiente', () => {
  const atual = { calculavel: true, score: 80, energiaNorm: 0.9, fisicoNorm: 0.8, emocionalNorm: 0.8, taxaFaltas: 0.1, taxaAfastamentos: 0 };
  const anterior = { calculavel: false, confiabilidade: 'INCONCLUSIVO' };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.comparavel, false);
  assert.equal(comparacao.motivo, 'AMOSTRA_INSUFICIENTE');
});

test('detecta melhora quando o score sobe', () => {
  const atual = { calculavel: true, score: 90, energiaNorm: 0.9, fisicoNorm: 0.9, emocionalNorm: 0.9, taxaFaltas: 0, taxaAfastamentos: 0 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.7, fisicoNorm: 0.7, emocionalNorm: 0.7, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.comparavel, true);
  assert.equal(comparacao.tendencia, 'MELHORA');
  assert.ok(comparacao.variacaoScorePercentual > 0);
});

test('detecta piora quando o score cai além do limiar', () => {
  const atual = { calculavel: true, score: 50, energiaNorm: 0.5, fisicoNorm: 0.5, emocionalNorm: 0.5, taxaFaltas: 0.3, taxaAfastamentos: 0.2 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.7, fisicoNorm: 0.7, emocionalNorm: 0.7, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.tendencia, 'PIORA');
});

test('variação pequena é classificada como estável', () => {
  const atual = { calculavel: true, score: 71, energiaNorm: 0.71, fisicoNorm: 0.71, emocionalNorm: 0.71, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.70, fisicoNorm: 0.70, emocionalNorm: 0.70, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.tendencia, 'ESTAVEL');
});
