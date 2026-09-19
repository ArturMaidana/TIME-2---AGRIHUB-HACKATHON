import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndiceAtencao } from '../src/domain/indice-atencao.js';

const config = {
  pesoEnergia: 0.30, pesoFisico: 0.20, pesoEmocional: 0.20, pesoFaltas: 0.15, pesoAfastamentos: 0.15,
  limiarVerde: 70, limiarAmarelo: 50, amostraMinima: 5, coberturaAlvo: 0.6,
};

function distribuicao(nota, quantidade) {
  return { [nota]: quantidade };
}

test('marca INCONCLUSIVO abaixo da amostra mínima', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 2), PHYSICAL: distribuicao(1, 2), STRESS: distribuicao(1, 2) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.deepEqual(resultado, { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 2 });
});

test('cenário saudável com amostra alta gera score alto e confiabilidade ALTA', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 10), PHYSICAL: distribuicao(1, 10), STRESS: distribuicao(1, 10) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.score, 100);
  assert.equal(resultado.status, 'VERDE');
  assert.equal(resultado.confiabilidade, 'ALTA');
  assert.equal(resultado.taxaParticipacao, 10 / 15);
});

test('faltas e afastamentos derrubam o score mesmo com bem-estar bom', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 8), PHYSICAL: distribuicao(1, 8), STRESS: distribuicao(1, 8) },
    faltas: 15, afastamentos: 15, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.score, 70);
  assert.equal(resultado.status, 'VERDE');
});

test('amostra entre o mínimo e o ideal é BAIXA confiabilidade, não oculta o score', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(3, 6), PHYSICAL: distribuicao(3, 6), STRESS: distribuicao(3, 6) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.confiabilidade, 'BAIXA');
});

test('classifica exatamente nos limites', () => {
  const casos = [
    [{ ENERGY: distribuicao(5, 10), PHYSICAL: distribuicao(1, 10), STRESS: distribuicao(1, 10) }, 0, 0, 'VERDE'],
    [{ ENERGY: distribuicao(3, 10), PHYSICAL: distribuicao(3, 10), STRESS: distribuicao(3, 10) }, 7, 8, 'AMARELO'],
    [{ ENERGY: distribuicao(1, 10), PHYSICAL: distribuicao(5, 10), STRESS: distribuicao(5, 10) }, 15, 15, 'VERMELHO'],
  ];
  for (const [respostas, faltas, afastamentos, esperado] of casos) {
    const resultado = calcularIndiceAtencao({ respostas, faltas, afastamentos, efetivoEsperado: 15, config });
    assert.equal(resultado.status, esperado, JSON.stringify({ respostas, faltas, afastamentos }));
  }
});
