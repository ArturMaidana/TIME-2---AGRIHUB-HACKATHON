import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ResponseModel } from '../models/response-model.js';

const simulatedAnalysis = {
  attention: 'MODERADA',
  title: 'Sinais físicos pedem atenção nesta semana',
  summary: 'A IA identificou aumento simultâneo de dor, cansaço e faltas no período. Os dados sugerem uma associação operacional que merece acompanhamento, sem indicar causalidade individual.',
  actions: [
    'Reforçar pausas e alternância das tarefas críticas',
    'Realizar escuta coletiva no início do próximo turno',
    'Acompanhar faltas e afastamentos na próxima semana',
  ],
  monthly: 'No consolidado mensal, a energia permaneceu estável, mas o indicador físico caiu 8%. O aumento de faltas no mesmo período reforça a necessidade de acompanhamento preventivo.',
};

export const DashboardService = {
  get({ unitId, sectorId, days = 30 }) {
    return {
      series: ResponseModel.getSeries({ unitId, sectorId, days }),
      latest: ResponseModel.getTodayBySector(unitId),
      sectorSummary: ResponseModel.getMonthlyBySector(unitId),
      hr: HrIndicatorModel.listRecent({ unitId, sectorId }),
      analysis: simulatedAnalysis,
    };
  },
};
