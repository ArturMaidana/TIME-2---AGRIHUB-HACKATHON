import { db } from '../config/database.js';

export const SectorModel = {
  listActiveByUnit(unitId) {
    return db.prepare(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = ? AND active = 1
      ORDER BY category DESC, name
    `).all(unitId);
  },

  listByUnit(unitId) {
    return db.prepare(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = ?
      ORDER BY category DESC, name
    `).all(unitId);
  },

  findActiveInUnit(id, unitId) {
    return db.prepare(`
      SELECT id FROM sectors WHERE id = ? AND unit_id = ? AND active = 1
    `).get(id, unitId);
  },
};
