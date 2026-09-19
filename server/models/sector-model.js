import { queryAll, queryOne } from '../config/database.js';

export const SectorModel = {
  listActiveByUnit(unitId) {
    return queryAll(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = $1 AND active = 1
      ORDER BY category DESC, name
    `, [unitId]);
  },

  listByUnit(unitId) {
    return queryAll(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = $1
      ORDER BY category DESC, name
    `, [unitId]);
  },

  findActiveInUnit(id, unitId) {
    return queryOne(`
      SELECT id FROM sectors WHERE id = $1 AND unit_id = $2 AND active = 1
    `, [id, unitId]);
  },
};
