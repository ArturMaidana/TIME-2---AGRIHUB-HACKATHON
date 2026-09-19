import { randomUUID } from 'node:crypto';
import { pool, queryAll } from '../config/database.js';

export const ResponseModel = {
  async incrementAnswers({ unitId, sectorId, shiftId, date, answers, idempotencyKey }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(`
        INSERT INTO requisicoes_totem(unidade_id, idempotency_key, criado_em)
        VALUES($1, $2, $3)
        ON CONFLICT (unidade_id, idempotency_key) DO NOTHING
      `, [unitId, idempotencyKey, new Date().toISOString()]);
      if (inserted.rowCount === 0) {
        await client.query('COMMIT');
        return;
      }
      for (const [metric, score] of Object.entries(answers)) {
        await client.query(`
          INSERT INTO responses VALUES($1, $2, $3, $4, $5, $6, $7, 1)
          ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score)
          DO UPDATE SET quantity = responses.quantity + 1
        `, [randomUUID(), unitId, sectorId, shiftId, date, metric, score]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getSeries({ unitId, sectorId, days }) {
    const scoped = sectorId && sectorId !== 'all';
    return queryAll(`
      SELECT response_date AS date, metric,
        ROUND(SUM(score * quantity)::numeric / SUM(quantity), 2) AS average,
        SUM(quantity) AS responses
      FROM responses
      WHERE unit_id = $1 AND response_date >= to_char(CURRENT_DATE - $2::int, 'YYYY-MM-DD')
        ${scoped ? 'AND sector_id = $3' : ''}
      GROUP BY response_date, metric
      ORDER BY response_date
    `, scoped ? [unitId, days - 1, sectorId] : [unitId, days - 1]);
  },

  getTodayBySector(unitId) {
    return queryAll(`
      SELECT s.id, s.name, r.metric,
        ROUND(SUM(r.score * r.quantity)::numeric / NULLIF(SUM(r.quantity), 0), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id AND r.response_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')
      WHERE s.unit_id = $1
      GROUP BY s.id, r.metric
      ORDER BY s.name
    `, [unitId]);
  },

  getMonthlyBySector(unitId) {
    return queryAll(`
      SELECT s.id, s.name, s.category, r.metric,
        ROUND(SUM(r.score * r.quantity)::numeric / NULLIF(SUM(r.quantity), 0), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id
        AND r.response_date >= to_char(CURRENT_DATE - 29, 'YYYY-MM-DD')
      WHERE s.unit_id = $1
      GROUP BY s.id, s.name, s.category, r.metric
      ORDER BY s.category DESC, s.name
    `, [unitId]);
  },
};
