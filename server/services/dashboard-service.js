import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ResponseModel } from '../models/response-model.js';
import { AnaliseModel } from '../models/analise-model.js';

function fallbackAnalysis() {
  return {
    attention: 'BAIXA',
    title: 'Ainda sem análise semanal gerada para este setor',
    summary: 'Assim que houver amostra suficiente, a análise semanal aparecerá aqui.',
    actions: [],
    monthly: 'Análise mensal ainda não gerada para este setor.',
  };
}

export const DashboardService = {
  async get({ unitId, sectorId, days = 30 }) {
    const [series, latest, sectorSummary, hr, analisesSemanal] = await Promise.all([
      ResponseModel.getSeries({ unitId, sectorId, days }),
      ResponseModel.getTodayBySector(unitId),
      ResponseModel.getMonthlyBySector(unitId),
      HrIndicatorModel.listRecent({ unitId, sectorId }),
      AnaliseModel.listByUnit({ unidadeId: unitId, periodicidade: 'SEMANAL', setorIds: sectorId && sectorId !== 'all' ? [sectorId] : null }),
    ]);
    const maisRecente = analisesSemanal[0];
    const analysis = maisRecente ? {
      attention: maisRecente.nivel_atencao,
      title: `Análise de ${maisRecente.setor_nome} (${maisRecente.turno_nome})`,
      summary: maisRecente.resumo,
      actions: maisRecente.evidencias,
      monthly: maisRecente.resumo,
    } : fallbackAnalysis();
    return { series, latest, sectorSummary, hr, analysis };
  },
};
