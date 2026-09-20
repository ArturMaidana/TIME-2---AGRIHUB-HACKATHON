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
    const maisRecente = analisesSemanal[0];
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
