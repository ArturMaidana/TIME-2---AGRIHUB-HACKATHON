import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute, pool } from '../config/database.js';

export const PlanoAcaoModel = {
  findByAnalise(analiseId) {
    return queryOne('SELECT id FROM planos_acao WHERE analise_id = $1', [analiseId]);
  },

  async createFromAnalise({ analiseId, unidadeId, setorId, turnoId, acoes }) {
    const existing = await PlanoAcaoModel.findByAnalise(analiseId);
    if (existing) return existing.id;

    const client = await pool.connect();
    const now = new Date().toISOString();
    const planoId = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO planos_acao(id, analise_id, unidade_id, setor_id, turno_id, status, criado_em, atualizado_em)
        VALUES($1, $2, $3, $4, $5, 'PENDENTE', $6, $6)
      `, [planoId, analiseId, unidadeId, setorId, turnoId, now]);
      let ordem = 1;
      for (const descricao of acoes) {
        await client.query(`
          INSERT INTO acoes_plano(id, plano_id, descricao, ordem, status)
          VALUES($1, $2, $3, $4, 'PENDENTE')
        `, [randomUUID(), planoId, descricao, ordem]);
        ordem += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return planoId;
  },

  listByUnit({ unidadeId, setorIds }) {
    const clauses = ['p.unidade_id = $1'];
    const params = [unidadeId];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`p.setor_id = ANY($${params.length})`);
    }
    return queryAll(`
      SELECT p.*, s.name AS setor_nome, sh.name AS turno_nome,
        COALESCE(json_agg(json_build_object('id', ap.id, 'descricao', ap.descricao, 'ordem', ap.ordem, 'status', ap.status)
          ORDER BY ap.ordem) FILTER (WHERE ap.id IS NOT NULL), '[]') AS acoes
      FROM planos_acao p
      JOIN sectors s ON s.id = p.setor_id
      JOIN shifts sh ON sh.id = p.turno_id
      LEFT JOIN acoes_plano ap ON ap.plano_id = p.id
      WHERE ${clauses.join(' AND ')}
      GROUP BY p.id, s.name, sh.name
      ORDER BY p.criado_em DESC
    `, params);
  },

  async updateStatus({ id, unidadeId, status }) {
    const rowCount = await execute(`
      UPDATE planos_acao SET status = $1, atualizado_em = $2
      WHERE id = $3 AND unidade_id = $4
    `, [status, new Date().toISOString(), id, unidadeId]);
    return rowCount > 0;
  },
};
