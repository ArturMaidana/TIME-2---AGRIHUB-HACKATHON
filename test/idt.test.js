import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIdt, classificarIdt } from '../src/domain/idt.js';

const vazio = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

test('classifica exatamente nos limites padrão', () => {
  assert.equal(classificarIdt(70), 'VERDE');
  assert.equal(classificarIdt(50), 'AMARELO');
  assert.equal(classificarIdt(49.99), 'VERMELHO');
});

test('não calcula sem amostra nos dois momentos', () => {
  const entrada = vazio();
  entrada[5] = 10;
  assert.deepEqual(calcularIdt({ entrada, saida: vazio(), efetivoEsperado: 10 }), {
    calculavel: false,
    motivo: 'DADOS_INSUFICIENTES',
  });
});

test('calcula cenário saudável com participação completa', () => {
  const entrada = vazio();
  const saida = vazio();
  entrada[5] = 10;
  saida[5] = 10;
  const resultado = calcularIdt({ entrada, saida, efetivoEsperado: 10 });
  assert.equal(resultado.score, 100);
  assert.equal(resultado.status, 'VERDE');
  assert.equal(resultado.taxaParticipacao, 1);
});

test('penaliza queda entre entrada e saída', () => {
  const entrada = vazio();
  const saida = vazio();
  entrada[5] = 10;
  saida[1] = 10;
  const resultado = calcularIdt({ entrada, saida, efetivoEsperado: 10 });
  assert.equal(resultado.deltaNormalizado, 1);
  assert.equal(resultado.percentualCriticas, 0.5);
  assert.equal(resultado.score, 49);
  assert.equal(resultado.status, 'VERMELHO');
});

test('limita participação a cem por cento', () => {
  const entrada = vazio();
  const saida = vazio();
  entrada[4] = 20;
  saida[4] = 20;
  const resultado = calcularIdt({ entrada, saida, efetivoEsperado: 10 });
  assert.equal(resultado.taxaParticipacao, 1);
  assert.ok(resultado.score <= 100);
});
