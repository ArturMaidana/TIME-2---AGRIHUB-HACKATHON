import { dateKey } from '../utils/date.js';
import { ResponseModel } from '../models/response-model.js';
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';

const METRICS = ['ENERGY', 'PHYSICAL', 'STRESS'];

function findCurrentShift(unitId, now = new Date()) {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const shifts = ShiftModel.listRawByUnit(unitId);
  return shifts.find((shift) => shift.start_time < shift.end_time
    ? time >= shift.start_time && time < shift.end_time
    : time >= shift.start_time || time < shift.end_time) ?? shifts[0];
}

export const TotemService = {
  getContext(unitId) {
    return {
      sectors: SectorModel.listActiveByUnit(unitId),
      shift: findCurrentShift(unitId),
      date: dateKey(),
    };
  },

  record(unitId, { sectorId, answers }) {
    const validAnswers = answers && METRICS.every((metric) =>
      Number.isInteger(answers[metric]) && answers[metric] >= 1 && answers[metric] <= 5);
    if (!sectorId || !validAnswers) return { ok: false, error: 'Responda as três perguntas' };
    if (!SectorModel.findActiveInUnit(sectorId, unitId)) {
      return { ok: false, error: 'Setor inválido' };
    }
    const shift = findCurrentShift(unitId);
    ResponseModel.incrementAnswers({
      unitId, sectorId, shiftId: shift.id, date: dateKey(), answers,
    });
    return { ok: true };
  },
};
