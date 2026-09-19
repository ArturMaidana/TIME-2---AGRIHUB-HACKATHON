import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const AlertaModel = {
  findActive({ unidadeId, setorId, turnoId, regra }) {
    return queryOne(`
      SELECT id FROM alertas
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND regra = $4
        AND status IN ('ABERTO', 'EM_ANALISE')
    `, [unidadeId, setorId, turnoId, regra]);
  },

  async createIfNotActive({ unidadeId, setorId, turnoId, regra, nivel, motivo, dadosOrigem }) {
    if (await AlertaModel.findActive({ unidadeId, setorId, turnoId, regra })) return null;
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO alertas(id, unidade_id, setor_id, turno_id, regra, nivel, status, motivo, dados_origem, gerado_em, atualizado_em)
      VALUES($1, $2, $3, $4, $5, $6, 'ABERTO', $7, $8, $9, $9)
      ON CONFLICT DO NOTHING
    `, [randomUUID(), unidadeId, setorId, turnoId, regra, nivel, motivo, JSON.stringify(dadosOrigem), now]);
    return true;
  },

  listByUnit({ unidadeId, setorIds, status }) {
    const clauses = ['unidade_id = $1'];
    const params = [unidadeId];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`setor_id = ANY($${params.length})`);
    }
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    return queryAll(`
      SELECT a.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM alertas a
      JOIN sectors s ON s.id = a.setor_id
      JOIN shifts sh ON sh.id = a.turno_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.gerado_em DESC
    `, params);
  },

  async updateStatus({ id, unidadeId, status }) {
    const rowCount = await execute(`
      UPDATE alertas SET status = $1, atualizado_em = $2
      WHERE id = $3 AND unidade_id = $4
    `, [status, new Date().toISOString(), id, unidadeId]);
    return rowCount > 0;
  },
};
