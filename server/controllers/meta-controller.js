import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { findCurrentShift } from '../services/shift-service.js';
import { json } from '../utils/http.js';

export async function getMeta(_request, response, { session }) {
  const [sectors, shifts, currentShift] = await Promise.all([
    SectorModel.listByUnit(session.unitId),
    ShiftModel.listByUnit(session.unitId),
    findCurrentShift(session.unitId),
  ]);
  json(response, 200, { sectors, shifts, currentShiftId: currentShift.id });
}
