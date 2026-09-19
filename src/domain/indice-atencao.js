function media(distribuicao) {
  const entries = Object.entries(distribuicao ?? {});
  const quantidade = entries.reduce((sum, [, qty]) => sum + qty, 0);
  if (quantidade === 0) return { media: null, quantidade: 0 };
  const soma = entries.reduce((sum, [nota, qty]) => sum + Number(nota) * qty, 0);
  return { media: soma / quantidade, quantidade };
}

export function classificarIndice(score, config) {
  if (score >= config.limiarVerde) return 'VERDE';
  if (score >= config.limiarAmarelo) return 'AMARELO';
  return 'VERMELHO';
}

export function calcularIndiceAtencao({ respostas, faltas = 0, afastamentos = 0, efetivoEsperado, config }) {
  const energia = media(respostas.ENERGY);
  const fisico = media(respostas.PHYSICAL);
  const emocional = media(respostas.STRESS);
  const totalRespostas = Math.round((energia.quantidade + fisico.quantidade + emocional.quantidade) / 3);

  if (totalRespostas < config.amostraMinima || energia.media === null || fisico.media === null || emocional.media === null) {
    return { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas };
  }

  const energiaNorm = energia.media / 5;
  const fisicoNorm = (6 - fisico.media) / 5;
  const emocionalNorm = (6 - emocional.media) / 5;
  const taxaFaltas = Math.min(1, faltas / efetivoEsperado);
  const taxaAfastamentos = Math.min(1, afastamentos / efetivoEsperado);

  const scoreBruto = 100 * (
    config.pesoEnergia * energiaNorm
    + config.pesoFisico * fisicoNorm
    + config.pesoEmocional * emocionalNorm
    + config.pesoFaltas * (1 - taxaFaltas)
    + config.pesoAfastamentos * (1 - taxaAfastamentos)
  );
  const score = Math.round(scoreBruto * 100) / 100;
  const status = classificarIndice(score, config);

  const amostraIdeal = efetivoEsperado * config.coberturaAlvo;
  const confiabilidade = totalRespostas >= amostraIdeal ? 'ALTA' : 'BAIXA';
  const taxaParticipacao = Math.min(1, totalRespostas / efetivoEsperado);

  return {
    calculavel: true, score, status, confiabilidade, totalRespostas, taxaParticipacao,
    energiaNorm, fisicoNorm, emocionalNorm, taxaFaltas, taxaAfastamentos,
  };
}
