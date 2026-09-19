import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const IndiceSetorModel = {
  upsert({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo, resultado }) {
    return execute(`
      INSERT INTO indices_setor(
        id, unidade_id, setor_id, turno_id, tipo_periodo, data_periodo,
        score, status, confiabilidade, total_respostas, taxa_participacao, detalhe, calculado_em
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (unidade_id, setor_id, turno_id, tipo_periodo, data_periodo)
      DO UPDATE SET score = $7, status = $8, confiabilidade = $9, total_respostas = $10,
        taxa_participacao = $11, detalhe = $12, calculado_em = $13
    `, [
      randomUUID(), unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo,
      resultado.calculavel ? resultado.score : null,
      resultado.calculavel ? resultado.status : null,
      resultado.confiabilidade,
      resultado.totalRespostas,
      resultado.calculavel ? resultado.taxaParticipacao : null,
      JSON.stringify(resultado),
      new Date().toISOString(),
    ]);
  },

  find({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    return queryOne(`
      SELECT * FROM indices_setor
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND tipo_periodo = $4 AND data_periodo = $5
    `, [unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo]);
  },

  listHistory({ unidadeId, setorId, turnoId, tipoPeriodo, limit = 30 }) {
    return queryAll(`
      SELECT * FROM indices_setor
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND tipo_periodo = $4
      ORDER BY data_periodo DESC
      LIMIT $5
    `, [unidadeId, setorId, turnoId, tipoPeriodo, limit]);
  },
};
