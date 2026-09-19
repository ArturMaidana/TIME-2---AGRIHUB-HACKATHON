import { compararPeriodos } from '../../src/domain/comparacao-temporal.js';
import { avaliarAlertas } from '../../src/domain/alertas.js';
import { gerarAnalise } from '../../src/domain/analise-planos.js';
import { ConfigModel } from '../models/config-model.js';
import { IndiceSetorModel } from '../models/indice-setor-model.js';
import { IndiceSetorService } from './indice-setor-service.js';
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { AlertaModel } from '../models/alerta-model.js';
import { AnaliseModel } from '../models/analise-model.js';
import { PlanoAcaoModel } from '../models/plano-acao-model.js';
import { HrIndicatorModel } from '../models/hr-indicator-model.js';

function periodoAnterior(tipoPeriodo, dataPeriodo) {
  const data = new Date(`${dataPeriodo}T00:00:00Z`);
  if (tipoPeriodo === 'DIARIO') data.setUTCDate(data.getUTCDate() - 1);
  else if (tipoPeriodo === 'SEMANAL') data.setUTCDate(data.getUTCDate() - 7);
  else data.setUTCMonth(data.getUTCMonth() - 1);
  return data.toISOString().slice(0, 10);
}

export const SupervisorAnalyticsService = {
  async indices({ unidadeId, setorIds, turnoId, tipoPeriodo, dataPeriodo }) {
    const setores = setorIds
      ? (await Promise.all(setorIds.map((id) => SectorModel.findActiveInUnit(id, unidadeId)))).filter(Boolean)
      : await SectorModel.listActiveByUnit(unidadeId);
    const config = await ConfigModel.getForUnit(unidadeId);

    return Promise.all(setores.map(async (setor) => {
      const atual = await IndiceSetorService.calcularEArmazenar({
        unidadeId, setorId: setor.id, turnoId, tipoPeriodo, dataPeriodo,
      });
      const historico = await IndiceSetorModel.listHistory({
        unidadeId, setorId: setor.id, turnoId, tipoPeriodo, limit: config.diasConsecutivosAmarelo + 1,
      });
      const historicoDetalhe = historico.map((row) => row.detalhe);
      const comparacao = historicoDetalhe[1]
        ? compararPeriodos(historicoDetalhe[0], historicoDetalhe[1], config)
        : { comparavel: false };
      const gatilhos = avaliarAlertas({ historico: historicoDetalhe, comparacao, config });
      for (const gatilho of gatilhos) {
        await AlertaModel.createIfNotActive({
          unidadeId, setorId: setor.id, turnoId, regra: gatilho.regra, nivel: gatilho.nivel,
          motivo: gatilho.motivo, dadosOrigem: gatilho.dadosOrigem,
        });
      }
      return atual;
    }));
  },

  async alertas({ unidadeId, setorIds, status }) {
    return AlertaModel.listByUnit({ unidadeId, setorIds, status });
  },

  async atualizarAlerta({ unidadeId, id, status }) {
    const validStatuses = ['ABERTO', 'EM_ANALISE', 'TRATADO', 'DESCARTADO'];
    if (!validStatuses.includes(status)) return { ok: false, error: 'Status inválido' };
    const updated = await AlertaModel.updateStatus({ id, unidadeId, status });
    return updated ? { ok: true } : { ok: false, error: 'Alerta não encontrado' };
  },

  async gerarAnaliseEPlano({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo }) {
    const [setores, turnos, config] = await Promise.all([
      SectorModel.listActiveByUnit(unidadeId),
      ShiftModel.listByUnit(unidadeId),
      ConfigModel.getForUnit(unidadeId),
    ]);
    const setor = setores.find((item) => item.id === setorId);
    const turno = turnos.find((item) => item.id === turnoId);
    if (!setor || !turno) return null;
    const tipoPeriodo = periodicidade === 'SEMANAL' ? 'SEMANAL' : 'MENSAL';
    await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
    const historicoRows = await IndiceSetorModel.listHistory({
      unidadeId, setorId, turnoId, tipoPeriodo, limit: 2,
    });
    const historico = historicoRows.map((row) => row.detalhe);
    const comparacao = historico[1] ? compararPeriodos(historico[0], historico[1], config) : { comparavel: false };
    const alertasAbertos = await AlertaModel.listByUnit({ unidadeId, setorIds: [setorId], status: 'ABERTO' });
    const hrRows = await HrIndicatorModel.listRecent({ unitId: unidadeId, sectorId: setorId, limit: 1 });
    const hr = hrRows[0] ? { faltas: hrRows[0].absences, afastamentos: hrRows[0].leaves } : { faltas: 0, afastamentos: 0 };

    const analise = gerarAnalise({
      setorNome: setor.name, turnoNome: turno.name, historico, comparacao,
      alertasAbertos: alertasAbertos.map((alerta) => ({ regra: alerta.regra, motivo: alerta.motivo })),
      hr,
    });

    const stored = await AnaliseModel.upsert({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise });
    await PlanoAcaoModel.createFromAnalise({
      analiseId: stored.id, unidadeId, setorId, turnoId, acoes: analise.acoesSugeridas,
    });
    return stored;
  },

  async analises({ unidadeId, periodicidade, setorIds, dataPeriodo }) {
    const setores = setorIds
      ? (await Promise.all(setorIds.map((id) => SectorModel.findActiveInUnit(id, unidadeId)))).filter(Boolean)
      : await SectorModel.listActiveByUnit(unidadeId);
    const turnos = await ShiftModel.listByUnit(unidadeId);

    await Promise.all(setores.flatMap((setor) => turnos.map((turno) => this.gerarAnaliseEPlano({
      unidadeId, setorId: setor.id, turnoId: turno.id, periodicidade, dataPeriodo,
    }))));

    return AnaliseModel.listByUnit({ unidadeId, periodicidade, setorIds });
  },

  async planosAcao({ unidadeId, setorIds }) {
    return PlanoAcaoModel.listByUnit({ unidadeId, setorIds });
  },

  async atualizarPlanoAcao({ unidadeId, id, status }) {
    const validStatuses = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'DESCARTADO'];
    if (!validStatuses.includes(status)) return { ok: false, error: 'Status inválido' };
    const updated = await PlanoAcaoModel.updateStatus({ id, unidadeId, status });
    return updated ? { ok: true } : { ok: false, error: 'Plano não encontrado' };
  },

  async comparativo({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const config = await ConfigModel.getForUnit(unidadeId);
    const atualRow = await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
    const anteriorData = periodoAnterior(tipoPeriodo, dataPeriodo);
    const anteriorRow = await IndiceSetorService.calcularEArmazenar({
      unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo: anteriorData,
    });
    return {
      atual: atualRow,
      anterior: anteriorRow,
      comparacao: compararPeriodos(atualRow.detalhe, anteriorRow.detalhe, config),
    };
  },

  async participacao({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const row = await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
    return {
      totalRespostas: row.total_respostas,
      taxaParticipacao: row.taxa_participacao === null ? null : Number(row.taxa_participacao),
      confiabilidade: row.confiabilidade,
    };
  },

  async historico({ unidadeId, setorId, turnoId, tipoPeriodo, limit }) {
    return IndiceSetorModel.listHistory({ unidadeId, setorId, turnoId, tipoPeriodo, limit });
  },
};
