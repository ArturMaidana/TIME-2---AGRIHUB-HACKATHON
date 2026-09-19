import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const AnaliseModel = {
  async upsert({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise }) {
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO analises_periodicas(
        id, unidade_id, setor_id, turno_id, periodicidade, data_periodo, versao_motor,
        resumo, evidencias, correlacoes, nivel_atencao, indicadores_acompanhar, gerado_em
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (unidade_id, setor_id, turno_id, periodicidade, data_periodo)
      DO UPDATE SET resumo = $8, evidencias = $9, correlacoes = $10, nivel_atencao = $11,
        indicadores_acompanhar = $12, gerado_em = $13
    `, [
      randomUUID(), unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise.versaoMotor,
      analise.resumo, JSON.stringify(analise.evidencias), JSON.stringify(analise.correlacoes),
      analise.nivelAtencao, JSON.stringify(analise.indicadoresAcompanhar), now,
    ]);
    return queryOne(`
      SELECT * FROM analises_periodicas
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND periodicidade = $4 AND data_periodo = $5
    `, [unidadeId, setorId, turnoId, periodicidade, dataPeriodo]);
  },

  listByUnit({ unidadeId, periodicidade, setorIds }) {
    const clauses = ['unidade_id = $1', 'periodicidade = $2'];
    const params = [unidadeId, periodicidade];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`setor_id = ANY($${params.length})`);
    }
    return queryAll(`
      SELECT a.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM analises_periodicas a
      JOIN sectors s ON s.id = a.setor_id
      JOIN shifts sh ON sh.id = a.turno_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.data_periodo DESC
    `, params);
  },
};
