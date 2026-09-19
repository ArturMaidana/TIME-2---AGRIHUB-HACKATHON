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

    const user = await AuthModel.findUserByCode(code);
    if (!user) return null;
    return {
      token: createSession({ role: user.role, unitId: user.unit_id, userId: user.id }),
      role: user.role,
      name: user.name,
    };
  },
};
