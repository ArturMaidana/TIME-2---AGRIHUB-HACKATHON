import { dateKey } from '../utils/date.js';
import { ResponseModel } from '../models/response-model.js';
import { SectorModel } from '../models/sector-model.js';
import { findCurrentShift } from './shift-service.js';

const METRICS = ['ENERGY', 'PHYSICAL', 'STRESS'];

export const TotemService = {
  async getContext(unitId) {
    const [sectors, shift] = await Promise.all([
      SectorModel.listActiveByUnit(unitId),
      findCurrentShift(unitId),
    ]);
    return { sectors, shift, date: dateKey() };
  },

  async record(unitId, { sectorId, answers, idempotencyKey }) {
    const validAnswers = answers && METRICS.every((metric) =>
      Number.isInteger(answers[metric]) && answers[metric] >= 1 && answers[metric] <= 5);
    if (!sectorId || !validAnswers || !idempotencyKey) {
      return { ok: false, error: 'Responda as três perguntas' };
    }
    if (!(await SectorModel.findActiveInUnit(sectorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    const shift = await findCurrentShift(unitId);
    await ResponseModel.incrementAnswers({
      unitId, sectorId, shiftId: shift.id, date: dateKey(), answers, idempotencyKey,
    });
    return { ok: true };
  },
};
