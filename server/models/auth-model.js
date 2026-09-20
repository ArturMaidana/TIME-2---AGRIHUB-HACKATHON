import { randomUUID } from 'node:crypto';
import { queryOne, execute } from '../config/database.js';

export const AuthModel = {
  findUserByCode(code) {
    return queryOne('SELECT * FROM users WHERE code = $1', [code]);
  },

  findActiveTotemByCredential(credential) {
    return queryOne('SELECT * FROM totens WHERE credential = $1 AND active = 1', [credential]);
  },

  findAnyUnit() {
    return queryOne('SELECT id FROM units LIMIT 1');
  },

  async createFuncionarioPseudonimo(unitId) {
    const countRow = await queryOne(
      "SELECT COUNT(*)::int AS total FROM users WHERE unit_id = $1 AND role = 'FUNCIONARIO'",
      [unitId],
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = countRow.total + 1 + attempt;
      const code = `anonimo_${next}`;
      const inserted = await execute(
        'INSERT INTO users(id, unit_id, role, name, code) VALUES($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING',
        [randomUUID(), unitId, 'FUNCIONARIO', `Anônimo ${next}`, code],
      );
      if (inserted > 0) return AuthModel.findUserByCode(code);
    }
    throw new Error('Não foi possível gerar um pseudônimo único');
  },
};
