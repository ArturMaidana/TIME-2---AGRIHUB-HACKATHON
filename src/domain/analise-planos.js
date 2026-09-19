const ACOES_POR_MOTIVO = {
  DESGASTE_E_FALTAS: 'Reforçar pausas e avaliar rodízio de postos no setor',
  QUEDA_ENERGIA: 'Observar ritmo operacional e reforçar orientação ergonômica',
  AUMENTO_DOR_OU_ESTRESSE: 'Realizar escuta coletiva e revisar pausas do turno',
  INDICE_VERMELHO: 'Solicitar análise técnica do SESMT para o setor/turno',
  AMARELO_CONSECUTIVO: 'Acompanhar de perto os próximos períodos antes de escalar',
  AMOSTRA_REDUZIDA: 'Reforçar divulgação do totem para ampliar a amostra',
};

function nivelAtencao({ alertasAbertos, historico }) {
  if (alertasAbertos.some((alerta) => alerta.regra === 'INDICE_VERMELHO')) return 'ALTA';
  const atual = historico[0];
  if (atual?.status === 'VERMELHO') return 'ALTA';
  if (alertasAbertos.length > 0 || atual?.status === 'AMARELO') return 'MODERADA';
  return 'BAIXA';
}

function fallbackAcao(atual, setorNome) {
  if (!atual?.calculavel) {
    return `Reforçar a divulgação do totem em ${setorNome} para ampliar a amostra de respostas`;
  }
  const dimensoes = [
    { nome: 'energia', valor: atual.energiaNorm, sugestao: 'observar sinais de fadiga acumulada ao longo do turno' },
    { nome: 'dor/cansaço físico', valor: atual.fisicoNorm, sugestao: 'reforçar pausas e orientação ergonômica' },
    { nome: 'ansiedade/estresse', valor: atual.emocionalNorm, sugestao: 'manter escuta ativa e leve da equipe' },
  ];
  const maisFraca = dimensoes.reduce((pior, item) => (item.valor < pior.valor ? item : pior));
  return `Índice em ${atual.score} (${atual.status.toLowerCase()}) — ${maisFraca.sugestao}, com atenção especial a ${maisFraca.nome}`;
}

export function gerarAnalise({ setorNome, turnoNome, historico, comparacao, alertasAbertos, hr }) {
  const atual = historico[0];
  const nivel = nivelAtencao({ alertasAbertos, historico });

  const evidencias = [
    atual?.calculavel
      ? `Índice atual de ${setorNome} (${turnoNome}): ${atual.score} (${atual.status}), amostra ${atual.confiabilidade.toLowerCase()}`
      : `Amostra insuficiente para calcular o índice atual de ${setorNome} (${turnoNome})`,
    `Faltas agregadas no período: ${hr.faltas}; afastamentos agregados: ${hr.afastamentos}`,
    ...alertasAbertos.map((alerta) => `Alerta aberto: ${alerta.motivo}`),
  ];

  const correlacoes = [];
  if (comparacao.comparavel && comparacao.variacaoFisicoPercentual > 0 && comparacao.variacaoFaltasPercentual > 0) {
    correlacoes.push('Há associação entre o aumento de dor/cansaço e o aumento de faltas no mesmo período, sem indicar causalidade.');
  }
  if (comparacao.comparavel) {
    correlacoes.push(`Os dados coincidem com uma tendência geral de ${comparacao.tendencia.toLowerCase()} frente ao período anterior.`);
  } else {
    correlacoes.push('Sem período anterior comparável, a leitura de tendência fica limitada a este período isolado.');
  }

  const acoesSugeridas = [...new Set(alertasAbertos.map((alerta) => ACOES_POR_MOTIVO[alerta.regra]).filter(Boolean))]
    .slice(0, 3);
  if (acoesSugeridas.length === 0) {
    acoesSugeridas.push(fallbackAcao(atual, setorNome));
  }

  return {
    resumo: `${setorNome} (${turnoNome}) está em nível de atenção ${nivel.toLowerCase()}, com ${alertasAbertos.length} alerta(s) aberto(s).`,
    evidencias,
    correlacoes,
    nivelAtencao: nivel,
    acoesSugeridas,
    indicadoresAcompanhar: ['Energia', 'Dor/cansaço físico', 'Ansiedade/estresse', 'Faltas', 'Afastamentos'],
    aviso: 'Esta análise apoia decisões da liderança e não constitui diagnóstico individual.',
    versaoMotor: 'v1',
  };
}
