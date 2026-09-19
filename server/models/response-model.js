import { randomUUID } from 'node:crypto';
import { db } from '../config/database.js';

const incrementStatement = db.prepare(`
  INSERT INTO responses VALUES(?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(unit_id, sector_id, shift_id, response_date, metric, score)
  DO UPDATE SET quantity = quantity + 1
`);

export const ResponseModel = {
  incrementAnswers({ unitId, sectorId, shiftId, date, answers }) {
    for (const [metric, score] of Object.entries(answers)) {
      incrementStatement.run(randomUUID(), unitId, sectorId, shiftId, date, metric, score);
    }
  },

  getSeries({ unitId, sectorId, days }) {
    const scoped = sectorId && sectorId !== 'all';
    return db.prepare(`
      SELECT response_date AS date, metric,
        ROUND(SUM(score * quantity) * 1.0 / SUM(quantity), 2) AS average,
        SUM(quantity) AS responses
      FROM responses
      WHERE unit_id = ? AND response_date >= date('now', ?)
        ${scoped ? 'AND sector_id = ?' : ''}
      GROUP BY response_date, metric
      ORDER BY response_date
    `).all(unitId, `-${days - 1} days`, ...(scoped ? [sectorId] : []));
  },

  getTodayBySector(unitId) {
    return db.prepare(`
      SELECT s.id, s.name, r.metric,
        ROUND(SUM(r.score * r.quantity) * 1.0 / SUM(r.quantity), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id AND r.response_date = date('now')
      WHERE s.unit_id = ?
      GROUP BY s.id, r.metric
      ORDER BY s.name
    `).all(unitId);
  },

  getMonthlyBySector(unitId) {
    return db.prepare(`
      SELECT s.id, s.name, s.category, r.metric,
        ROUND(SUM(r.score * r.quantity) * 1.0 / SUM(r.quantity), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id
        AND r.response_date >= date('now', '-29 days')
      WHERE s.unit_id = ?
      GROUP BY s.id, s.name, s.category, r.metric
      ORDER BY s.category DESC, s.name
    `).all(unitId);
  },
};
