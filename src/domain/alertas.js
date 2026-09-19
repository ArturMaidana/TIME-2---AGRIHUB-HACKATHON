const UM_DIA_MS = 24 * 60 * 60 * 1000;

function dataUtc(data) {
  const instante = Date.parse(`${data}T00:00:00Z`);
  if (Number.isNaN(instante)) throw new TypeError(`data inválida: ${data}`);
  return instante;
}

/** Decide se o histórico encerrado na data mais recente exige um novo alerta. */
export function avaliarAlerta({ indices, regras = {}, alertaAtivo = false }) {
  if (alertaAtivo || indices.length === 0) return null;

  const limiarAmarelo = regras.limiarAmarelo ?? 70;
  const limiarVermelho = regras.limiarVermelho ?? 50;
  const diasConsecutivos = regras.diasConsecutivos ?? 2;
  const ordenados = [...indices].sort((a, b) => dataUtc(a.data) - dataUtc(b.data));
  const atual = ordenados.at(-1);

  if (atual.score < limiarVermelho) {
    return { nivel: 'VERMELHO', status: 'ESCALADO', dataReferencia: atual.data };
  }

  const janela = ordenados.slice(-diasConsecutivos);
  if (janela.length < diasConsecutivos) return null;

  const datasConsecutivas = janela.every((item, indice) => {
    if (indice === 0) return true;
    return dataUtc(item.data) - dataUtc(janela[indice - 1].data) === UM_DIA_MS;
  });
  const todosAbaixo = janela.every((item) => item.score < limiarAmarelo);

  return datasConsecutivas && todosAbaixo
    ? { nivel: 'AMARELO', status: 'ABERTO', dataReferencia: atual.data }
    : null;
}

export function deveEscalar({ status, geradoEm, agora, prazoTratativaHoras = 48 }) {
  if (!['ABERTO', 'EM_TRATATIVA'].includes(status)) return false;
  const inicio = new Date(geradoEm).getTime();
  const fim = new Date(agora).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim)) {
    throw new TypeError('geradoEm e agora devem ser datas válidas');
  }
  return fim - inicio > prazoTratativaHoras * 60 * 60 * 1000;
}
