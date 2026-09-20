import { ShiftModel } from '../models/shift-model.js';
import { appConfig } from '../config/app-config.js';

export async function findCurrentShift(unitId, now = new Date()) {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: appConfig.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const shifts = await ShiftModel.listRawByUnit(unitId);
  return shifts.find((shift) => shift.start_time < shift.end_time
    ? time >= shift.start_time && time < shift.end_time
    : time >= shift.start_time || time < shift.end_time) ?? shifts[0];
}
