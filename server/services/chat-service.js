import { dateKey } from '../utils/date.js';
import { ReclamacaoModel } from '../models/reclamacao-model.js';
import { SectorModel } from '../models/sector-model.js';
import { findCurrentShift } from './shift-service.js';

const TIPOS = ['RECLAMACAO', 'SUGESTAO'];

export const ChatService = {
  async getContexto(unitId) {
    const [sectors, shift] = await Promise.all([
      SectorModel.listActiveByUnit(unitId),
      findCurrentShift(unitId),
    ]);
    return { sectors, shift, date: dateKey() };
  },

  async minhasMensagens(usuarioId) {
    return ReclamacaoModel.listByUsuario(usuarioId);
  },

  async enviar(unitId, usuarioId, { setorId, tipo, mensagem }) {
    if (!TIPOS.includes(tipo)) return { ok: false, error: 'Tipo inválido' };
    const texto = mensagem?.trim();
    if (!texto || texto.length > 2000) {
      return { ok: false, error: 'Mensagem deve ter entre 1 e 2000 caracteres' };
    }
    if (!(await SectorModel.findActiveInUnit(setorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    const shift = await findCurrentShift(unitId);
    await ReclamacaoModel.create({
      unidadeId: unitId, usuarioId, setorId, turnoId: shift.id, tipo, mensagem: texto,
    });
    return { ok: true };
  },
};
