import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ResponseModel } from '../models/response-model.js';
import { AnaliseModel } from '../models/analise-model.js';
import { ConfigModel } from '../models/config-model.js';

function fallbackAnalysis() {
  return {
    attention: 'BAIXA',
    title: 'Ainda sem análise semanal gerada para este setor',
    summary: 'Assim que houver amostra suficiente, a análise semanal aparecerá aqui.',
    actions: [],
    monthly: 'Análise mensal ainda não gerada para este setor.',
    poweredByAI: false,
  };
}

// Mesmo cálculo de "setor prioritário" que o frontend usa em sector-utils.js
// (buildSectorRows) — replicado aqui pra decidir qual análise destacar. Sem isso,
// o "Setor prioritário" do card de métricas e a análise mostrada em "Cruzamento
// da IA" podiam apontar pra setores diferentes, o que é incoerente pra quem lê o
// painel.
function ranquearSetoresPorBemEstar(sectorSummary) {
  const porSetor = {};
  for (const row of sectorSummary) {
    const item = porSetor[row.id] ??= { id: row.id, responses: 0 };
    if (row.metric) {
      item[row.metric] = Number(row.average);
      item.responses = Math.max(item.responses, Number(row.responses || 0));
    }
  }
  return Object.values(porSetor)
    .map((item) => ({
      ...item,
      wellness: item.ENERGY ? (item.ENERGY + (6 - item.PHYSICAL) + (6 - item.STRESS)) / 3 : 0,
    }))
    .sort((a, b) => a.wellness - b.wellness);
}

const SEVERIDADE = { ALTA: 2, MODERADA: 1, BAIXA: 0 };

// Entre as análises semanais já geradas, prioriza a do setor prioritário; se ele
// ainda não tiver análise calculável, cai pra mais severa disponível em vez de uma
// escolha arbitrária.
function escolherAnaliseDestaque(analises, setorPrioritarioId) {
  if (!analises.length) return null;
  const doSetorPrioritario = analises.filter((item) => item.setor_id === setorPrioritarioId);
  const candidatos = doSetorPrioritario.length ? doSetorPrioritario : analises;
  return [...candidatos].sort((a, b) => {
    const diffSeveridade = (SEVERIDADE[b.nivel_atencao] ?? 0) - (SEVERIDADE[a.nivel_atencao] ?? 0);
    if (diffSeveridade !== 0) return diffSeveridade;
    return b.data_periodo.localeCompare(a.data_periodo);
  })[0];
}

export const DashboardService = {
  async get({ unitId, sectorId, days = 30 }) {
    const [series, latest, sectorSummary, hr, analisesSemanal, config] = await Promise.all([
      ResponseModel.getSeries({ unitId, sectorId, days }),
      ResponseModel.getTodayBySector(unitId),
      ResponseModel.getMonthlyBySector(unitId),
      HrIndicatorModel.listRecent({ unitId, sectorId }),
      AnaliseModel.listByUnit({ unidadeId: unitId, periodicidade: 'SEMANAL', setorIds: sectorId && sectorId !== 'all' ? [sectorId] : null }),
      ConfigModel.getForUnit(unitId),
    ]);
    const ranking = ranquearSetoresPorBemEstar(sectorSummary);
    const setorPrioritarioId = ranking[0]?.id;
    const maisRecente = escolherAnaliseDestaque(analisesSemanal, setorPrioritarioId);
    // O texto com IA só é usado se o flag ESTIVER LIGADO AGORA — desligar o flag volta
    // instantaneamente pro resumo determinístico, mesmo que exista um resumo_ia em cache.
    const usaIA = Boolean(config?.usarIaGenerativa && maisRecente?.gerado_por_ia && maisRecente?.resumo_ia);
    const resumoFinal = usaIA ? maisRecente.resumo_ia : maisRecente?.resumo;
    const analysis = maisRecente ? {
      attention: maisRecente.nivel_atencao,
      title: `Análise de ${maisRecente.setor_nome} (${maisRecente.turno_nome})`,
      summary: resumoFinal,
      actions: maisRecente.evidencias,
      monthly: resumoFinal,
      poweredByAI: usaIA,
    } : fallbackAnalysis();
    return { series, latest, sectorSummary, hr, analysis };
  },
};
