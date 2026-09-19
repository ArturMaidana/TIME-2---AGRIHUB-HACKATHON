import { queryAll, queryOne } from '../config/database.js';

export const ShiftModel = {
  listByUnit(unitId) {
    return queryAll(`
      SELECT id, name, start_time AS "startTime", end_time AS "endTime"
      FROM shifts WHERE unit_id = $1 ORDER BY start_time
    `, [unitId]);
  },

  listRawByUnit(unitId) {
    return queryAll(`
      SELECT id, name, start_time, end_time
      FROM shifts WHERE unit_id = $1
    `, [unitId]);
  },

  findInUnit(id, unitId) {
    return queryOne('SELECT id FROM shifts WHERE id = $1 AND unit_id = $2', [id, unitId]);
  },
};
