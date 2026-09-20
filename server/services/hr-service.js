import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { isIsoDate, isNonNegativeInteger, isNonNegativeNumber } from '../utils/validation.js';

export const HrService = {
  async create(unitId, payload) {
    if (!(await SectorModel.findActiveInUnit(payload.sectorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    if (!(await ShiftModel.findInUnit(payload.shiftId, unitId))) {
      return { ok: false, error: 'Turno inválido' };
    }
    if (!isIsoDate(payload.period)) {
      return { ok: false, error: 'Período inválido' };
    }
    if (!isNonNegativeInteger(payload.absences) || !isNonNegativeInteger(payload.leaves)) {
      return { ok: false, error: 'Faltas e afastamentos devem ser inteiros não negativos' };
    }
    const overtimeHours = payload.overtimeHours === '' || payload.overtimeHours === undefined
      ? 0 : payload.overtimeHours;
    if (!isNonNegativeNumber(overtimeHours)) {
      return { ok: false, error: 'Horas extras devem ser um número não negativo' };
    }
    await HrIndicatorModel.create({ unitId, ...payload, overtimeHours });
    return { ok: true };
  },
};
