import { randomUUID } from 'node:crypto';
import { db } from '../config/database.js';

export const HrIndicatorModel = {
  listRecent({ unitId, sectorId, limit = 20 }) {
    const scoped = sectorId && sectorId !== 'all';
    return db.prepare(`
      SELECT h.*, s.name AS sector, sh.name AS shift
      FROM hr_indicators h
      JOIN sectors s ON s.id = h.sector_id
      JOIN shifts sh ON sh.id = h.shift_id
      WHERE h.unit_id = ? ${scoped ? 'AND h.sector_id = ?' : ''}
      ORDER BY period DESC
      LIMIT ?
    `).all(unitId, ...(scoped ? [sectorId] : []), limit);
  },

  create({ unitId, sectorId, shiftId, period, absences, leaves }) {
    db.prepare(`
      INSERT INTO hr_indicators VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), unitId, sectorId, shiftId, period,
      0, Number(absences), Number(leaves), '', new Date().toISOString(),
    );
  },
};
