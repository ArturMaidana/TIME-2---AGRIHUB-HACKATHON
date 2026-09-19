import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { json } from '../utils/http.js';

export function getMeta(_request, response, { session }) {
  json(response, 200, {
    sectors: SectorModel.listByUnit(session.unitId),
    shifts: ShiftModel.listByUnit(session.unitId),
  });
}
