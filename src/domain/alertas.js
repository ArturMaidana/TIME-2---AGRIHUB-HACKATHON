export function avaliarAlertas({ historico, comparacao, config }) {
  const alertas = [];
  const atual = historico[0];
  if (!atual) return alertas;

  if (atual.calculavel && atual.status === 'VERMELHO') {
    alertas.push({
      regra: 'INDICE_VERMELHO', nivel: 'VERMELHO',
      motivo: `Índice em ${atual.score} (faixa vermelha)`,
      dadosOrigem: { score: atual.score },
    });
  }

  const amarelosConsecutivos = [];
  for (const registro of historico) {
    if (registro.calculavel && registro.status === 'AMARELO') amarelosConsecutivos.push(registro);
    else break;
  }
  if (amarelosConsecutivos.length >= config.diasConsecutivosAmarelo) {
    alertas.push({
      regra: 'AMARELO_CONSECUTIVO', nivel: 'AMARELO',
      motivo: `Índice em faixa amarela por ${amarelosConsecutivos.length} períodos consecutivos`,
      dadosOrigem: { periodos: amarelosConsecutivos.length },
    });
  }

  if (comparacao.comparavel) {
    const limiar = config.variacaoRelevantePercentual;
    if (comparacao.variacaoEnergiaPercentual !== null && comparacao.variacaoEnergiaPercentual <= -limiar) {
      alertas.push({
        regra: 'QUEDA_ENERGIA', nivel: 'AMARELO',
        motivo: `Energia caiu ${Math.round(Math.abs(comparacao.variacaoEnergiaPercentual) * 100)}% frente ao período anterior`,
        dadosOrigem: { variacaoEnergiaPercentual: comparacao.variacaoEnergiaPercentual },
      });
    }
    const pioraFisicoOuEmocional = (comparacao.variacaoFisicoPercentual !== null && comparacao.variacaoFisicoPercentual >= limiar)
      || (comparacao.variacaoEmocionalPercentual !== null && comparacao.variacaoEmocionalPercentual >= limiar);
    if (pioraFisicoOuEmocional) {
      alertas.push({
        regra: 'AUMENTO_DOR_OU_ESTRESSE', nivel: 'AMARELO',
        motivo: 'Aumento relevante de dor/cansaço ou ansiedade/estresse frente ao período anterior',
        dadosOrigem: {
          variacaoFisicoPercentual: comparacao.variacaoFisicoPercentual,
          variacaoEmocionalPercentual: comparacao.variacaoEmocionalPercentual,
        },
      });
    }
    const desgasteSobe = pioraFisicoOuEmocional;
    const faltasSobe = (comparacao.variacaoFaltasPercentual !== null && comparacao.variacaoFaltasPercentual >= limiar)
      || (comparacao.variacaoAfastamentosPercentual !== null && comparacao.variacaoAfastamentosPercentual >= limiar);
    if (desgasteSobe && faltasSobe) {
      alertas.push({
        regra: 'DESGASTE_E_FALTAS', nivel: 'AMARELO',
        motivo: 'Aumento simultâneo de desgaste físico/emocional e de faltas ou afastamentos',
        dadosOrigem: {
          variacaoFaltasPercentual: comparacao.variacaoFaltasPercentual,
          variacaoAfastamentosPercentual: comparacao.variacaoAfastamentosPercentual,
        },
      });
    }
  }

  if (!atual.calculavel && atual.confiabilidade === 'INCONCLUSIVO') {
    alertas.push({
      regra: 'AMOSTRA_REDUZIDA', nivel: 'AMARELO',
      motivo: `Amostra (${atual.totalRespostas}) abaixo do mínimo configurado (${config.amostraMinima})`,
      dadosOrigem: { totalRespostas: atual.totalRespostas, amostraMinima: config.amostraMinima },
    });
  }

  return alertas;
}
