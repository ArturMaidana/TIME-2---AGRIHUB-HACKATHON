import { AuthModel } from '../models/auth-model.js';
import { createSession } from '../config/session-store.js';

export const AuthService = {
  async authenticate({ type, code }) {
    if (type === 'TOTEM') {
      const totem = await AuthModel.findActiveTotemByCredential(code);
      if (!totem) return null;
      return {
        token: createSession({ role: 'TOTEM', unitId: totem.unit_id }),
        role: 'TOTEM',
        name: totem.name,
      };
    }

    if (type === 'FUNCIONARIO' && !code?.trim()) {
      const unit = await AuthModel.findAnyUnit();
      if (!unit) return null;
      const user = await AuthModel.createFuncionarioPseudonimo(unit.id);
      return {
        token: createSession({ role: 'FUNCIONARIO', unitId: unit.id, userId: user.id }),
        role: 'FUNCIONARIO',
        name: user.name,
        code: user.code,
      };
    }

    const user = await AuthModel.findUserByCode(code);
    if (!user) return null;
    return {
      token: createSession({ role: user.role, unitId: user.unit_id, userId: user.id }),
      role: user.role,
      name: user.name,
      code: user.code,
    };
  },
};
