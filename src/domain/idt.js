export const STATUS_IDT = Object.freeze({
  VERDE: 'VERDE',
  AMARELO: 'AMARELO',
  VERMELHO: 'VERMELHO',
});

const NOTAS = [1, 2, 3, 4, 5];

function clamp(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function validarContadores(contadores, campo) {
  if (!contadores || typeof contadores !== 'object') {
    throw new TypeError(`${campo} deve ser um objeto de contadores`);
  }

  for (const nota of NOTAS) {
    const quantidade = contadores[nota] ?? 0;
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw new RangeError(`${campo}[${nota}] deve ser um inteiro não negativo`);
    }
  }
}

function resumir(contadores) {
  const total = NOTAS.reduce((soma, nota) => soma + (contadores[nota] ?? 0), 0);
  const somaPonderada = NOTAS.reduce(
    (soma, nota) => soma + nota * (contadores[nota] ?? 0),
    0,
  );
  const criticas = (contadores[1] ?? 0) + (contadores[2] ?? 0);
  return { total, somaPonderada, criticas };
}

export function classificarIdt(score, limiares = {}) {
  const amarelo = limiares.amarelo ?? 70;
  const vermelho = limiares.vermelho ?? 50;

  if (!(vermelho < amarelo)) {
    throw new RangeError('o limiar vermelho deve ser menor que o amarelo');
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError('score deve estar entre 0 e 100');
  }

  if (score >= amarelo) return STATUS_IDT.VERDE;
  if (score >= vermelho) return STATUS_IDT.AMARELO;
  return STATUS_IDT.VERMELHO;
}

/**
 * Calcula o IDT sem acessar infraestrutura. Retorna dados insuficientes quando um
 * dos momentos não tem resposta, evitando produzir um sinal enganoso.
 */
export function calcularIdt({ entrada, saida, efetivoEsperado, limiares }) {
  validarContadores(entrada, 'entrada');
  validarContadores(saida, 'saida');
  if (!Number.isInteger(efetivoEsperado) || efetivoEsperado <= 0) {
    throw new RangeError('efetivoEsperado deve ser um inteiro positivo');
  }

  const resumoEntrada = resumir(entrada);
  const resumoSaida = resumir(saida);
  if (resumoEntrada.total === 0 || resumoSaida.total === 0) {
    return { calculavel: false, motivo: 'DADOS_INSUFICIENTES' };
  }

  const totalRespostas = resumoEntrada.total + resumoSaida.total;
  const mediaEntrada = resumoEntrada.somaPonderada / resumoEntrada.total;
  const mediaSaida = resumoSaida.somaPonderada / resumoSaida.total;
  const mediaDoDia =
    (resumoEntrada.somaPonderada + resumoSaida.somaPonderada) / totalRespostas;
  const deltaNormalizado = clamp((mediaEntrada - mediaSaida) / 4, 0, 1);
  const percentualCriticas =
    (resumoEntrada.criticas + resumoSaida.criticas) / totalRespostas;
  const taxaParticipacao = clamp(totalRespostas / (efetivoEsperado * 2), 0, 1);
  const score =
    40 * (mediaDoDia / 5) +
    25 * (1 - deltaNormalizado) +
    20 * (1 - percentualCriticas) +
    15 * taxaParticipacao;
  const scoreArredondado = Math.round(score * 100) / 100;

  return {
    calculavel: true,
    mediaEntrada: Math.round(mediaEntrada * 100) / 100,
    mediaSaida: Math.round(mediaSaida * 100) / 100,
    mediaDoDia: Math.round(mediaDoDia * 100) / 100,
    deltaNormalizado: Math.round(deltaNormalizado * 10_000) / 10_000,
    percentualCriticas: Math.round(percentualCriticas * 10_000) / 10_000,
    taxaParticipacao: Math.round(taxaParticipacao * 10_000) / 10_000,
    totalRespostas,
    score: scoreArredondado,
    status: classificarIdt(scoreArredondado, limiares),
  };
}
