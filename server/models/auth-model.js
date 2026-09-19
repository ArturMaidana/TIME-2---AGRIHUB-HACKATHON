import { queryOne } from '../config/database.js';

export const AuthModel = {
  findUserByCode(code) {
    return queryOne('SELECT * FROM users WHERE code = $1', [code]);
  },

  findActiveTotemByCredential(credential) {
    return queryOne('SELECT * FROM totens WHERE credential = $1 AND active = 1', [credential]);
  },
};
