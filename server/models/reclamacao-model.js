import { randomUUID } from 'node:crypto';
import { queryAll, execute } from '../config/database.js';

export const ReclamacaoModel = {
  create({ unidadeId, usuarioId, setorId, turnoId, tipo, mensagem }) {
    const now = new Date().toISOString();
    return execute(`
      INSERT INTO reclamacoes_sugestoes(
        id, unidade_id, usuario_id, setor_id, turno_id, tipo, mensagem, status, criado_em, atualizado_em
      ) VALUES($1, $2, $3, $4, $5, $6, $7, 'ABERTO', $8, $8)
    `, [randomUUID(), unidadeId, usuarioId, setorId, turnoId, tipo, mensagem, now]);
  },

  listByUsuario(usuarioId) {
    return queryAll(`
      SELECT r.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM reclamacoes_sugestoes r
      JOIN sectors s ON s.id = r.setor_id
      JOIN shifts sh ON sh.id = r.turno_id
      WHERE r.usuario_id = $1
      ORDER BY r.criado_em DESC
    `, [usuarioId]);
  },

  listByUnit({ unidadeId, setorIds, status }) {
    const clauses = ['r.unidade_id = $1'];
    const params = [unidadeId];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`r.setor_id = ANY($${params.length})`);
    }
    if (status) {
      params.push(status);
      clauses.push(`r.status = $${params.length}`);
    }
    return queryAll(`
      SELECT r.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM reclamacoes_sugestoes r
      JOIN sectors s ON s.id = r.setor_id
      JOIN shifts sh ON sh.id = r.turno_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY r.criado_em DESC
    `, params);
  },

  async updateStatus({ id, unidadeId, status, resposta }) {
    const now = new Date().toISOString();
    const rowCount = resposta?.trim()
      ? await execute(`
          UPDATE reclamacoes_sugestoes
          SET status = $1, resposta_supervisor = $2, respondido_em = $3, atualizado_em = $3
          WHERE id = $4 AND unidade_id = $5
        `, [status, resposta.trim(), now, id, unidadeId])
      : await execute(`
          UPDATE reclamacoes_sugestoes SET status = $1, atualizado_em = $2
          WHERE id = $3 AND unidade_id = $4
        `, [status, now, id, unidadeId]);
    return rowCount > 0;
  },
};
