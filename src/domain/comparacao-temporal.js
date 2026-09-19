function variacaoPercentual(atual, anterior) {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return (atual - anterior) / anterior;
}

export function compararPeriodos(atual, anterior, config) {
  if (!atual?.calculavel || !anterior?.calculavel) {
    return { comparavel: false, motivo: 'AMOSTRA_INSUFICIENTE' };
  }

  const variacaoScorePercentual = variacaoPercentual(atual.score, anterior.score);
  const tendencia = Math.abs(variacaoScorePercentual) < config.variacaoRelevantePercentual
    ? 'ESTAVEL'
    : variacaoScorePercentual > 0 ? 'MELHORA' : 'PIORA';

  return {
    comparavel: true,
    tendencia,
    variacaoScorePercentual,
    variacaoEnergiaPercentual: variacaoPercentual(atual.energiaNorm, anterior.energiaNorm),
    variacaoFisicoPercentual: variacaoPercentual(atual.fisicoNorm, anterior.fisicoNorm),
    variacaoEmocionalPercentual: variacaoPercentual(atual.emocionalNorm, anterior.emocionalNorm),
    variacaoFaltasPercentual: variacaoPercentual(atual.taxaFaltas, anterior.taxaFaltas),
    variacaoAfastamentosPercentual: variacaoPercentual(atual.taxaAfastamentos, anterior.taxaAfastamentos),
  };
}
