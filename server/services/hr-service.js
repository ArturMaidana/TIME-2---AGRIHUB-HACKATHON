import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { SectorModel } from '../models/sector-model.js';

export const HrService = {
  create(unitId, payload) {
    if (!SectorModel.findActiveInUnit(payload.sectorId, unitId)) {
      return { ok: false, error: 'Setor inválido' };
    }
    HrIndicatorModel.create({ unitId, ...payload });
    return { ok: true };
  },
};
