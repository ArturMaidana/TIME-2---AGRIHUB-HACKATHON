import { calcularIndiceAtencao } from '../../src/domain/indice-atencao.js';
import { queryAll, queryOne } from '../config/database.js';
import { ConfigModel } from '../models/config-model.js';
import { IndiceSetorModel } from '../models/indice-setor-model.js';

async function respostasNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }) {
  const rows = await queryAll(`
    SELECT metric, score, SUM(quantity)::int AS quantity
    FROM responses
    WHERE unit_id = $1 AND sector_id = $2 AND shift_id = $3
      AND response_date BETWEEN $4 AND $5
    GROUP BY metric, score
  `, [unidadeId, setorId, turnoId, dataInicio, dataFim]);

  const respostas = { ENERGY: {}, PHYSICAL: {}, STRESS: {} };
  for (const row of rows) respostas[row.metric][row.score] = row.quantity;
  return respostas;
}

async function hrNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }) {
  return queryOne(`
    SELECT COALESCE(SUM(absences), 0)::int AS faltas, COALESCE(SUM(leaves), 0)::int AS afastamentos
    FROM hr_indicators
    WHERE unit_id = $1 AND sector_id = $2 AND shift_id = $3 AND period BETWEEN $4 AND $5
  `, [unidadeId, setorId, turnoId, dataInicio, dataFim]);
}

async function efetivoEsperado({ unidadeId, setorId, turnoId }) {
  const row = await queryOne(`
    SELECT efetivo_esperado FROM efetivos_setor_turno
    WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3
  `, [unidadeId, setorId, turnoId]);
  return row?.efetivo_esperado ?? null;
}

function periodoParaIntervalo(tipoPeriodo, dataPeriodo) {
  if (tipoPeriodo === 'DIARIO') return { dataInicio: dataPeriodo, dataFim: dataPeriodo };
  const referencia = new Date(`${dataPeriodo}T00:00:00Z`);
  if (tipoPeriodo === 'SEMANAL') {
    const inicio = new Date(referencia);
    inicio.setUTCDate(inicio.getUTCDate() - 6);
    return { dataInicio: inicio.toISOString().slice(0, 10), dataFim: dataPeriodo };
  }
  const inicioMes = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1));
  return { dataInicio: inicioMes.toISOString().slice(0, 10), dataFim: dataPeriodo };
}

export const IndiceSetorService = {
  async calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const { dataInicio, dataFim } = periodoParaIntervalo(tipoPeriodo, dataPeriodo);
    const [respostas, hr, config, efetivo] = await Promise.all([
      respostasNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }),
      hrNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }),
      ConfigModel.getForUnit(unidadeId),
      efetivoEsperado({ unidadeId, setorId, turnoId }),
    ]);

    const resultado = efetivo
      ? calcularIndiceAtencao({
        respostas, faltas: hr.faltas, afastamentos: hr.afastamentos, efetivoEsperado: efetivo, config,
      })
      : { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 0 };

    await IndiceSetorModel.upsert({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo, resultado });
    return IndiceSetorModel.find({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
  },
};
