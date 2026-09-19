import { db } from '../config/database.js';

export const ShiftModel = {
  listByUnit(unitId) {
    return db.prepare(`
      SELECT id, name, start_time AS startTime, end_time AS endTime
      FROM shifts WHERE unit_id = ? ORDER BY start_time
    `).all(unitId);
  },

  listRawByUnit(unitId) {
    return db.prepare(`
      SELECT id, name, start_time, end_time
      FROM shifts WHERE unit_id = ?
    `).all(unitId);
  },

  findInUnit(id, unitId) {
    return db.prepare('SELECT id FROM shifts WHERE id = ? AND unit_id = ?').get(id, unitId);
  },
};
