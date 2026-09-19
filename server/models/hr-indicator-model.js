import { randomUUID } from 'node:crypto';
import { queryAll, execute } from '../config/database.js';

export const HrIndicatorModel = {
  listRecent({ unitId, sectorId, limit = 20 }) {
    const scoped = sectorId && sectorId !== 'all';
    const params = scoped ? [unitId, sectorId, limit] : [unitId, limit];
    return queryAll(`
      SELECT h.*, s.name AS sector, sh.name AS shift
      FROM hr_indicators h
      JOIN sectors s ON s.id = h.sector_id
      JOIN shifts sh ON sh.id = h.shift_id
      WHERE h.unit_id = $1 ${scoped ? 'AND h.sector_id = $2' : ''}
      ORDER BY period DESC
      LIMIT ${scoped ? '$3' : '$2'}
    `, params);
  },

  create({ unitId, sectorId, shiftId, period, absences, leaves }) {
    return execute(`
      INSERT INTO hr_indicators(id, unit_id, sector_id, shift_id, period, absences, leaves, created_at)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      randomUUID(), unitId, sectorId, shiftId, period,
      Number(absences), Number(leaves), new Date().toISOString(),
    ]);
  },
};
