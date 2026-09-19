import { db } from '../config/database.js';

export const AuthModel = {
  findUserByCode(code) {
    return db.prepare('SELECT * FROM users WHERE code = ?').get(code);
  },

  findActiveTotemByCredential(credential) {
    return db.prepare('SELECT * FROM totens WHERE credential = ? AND active = 1').get(credential);
  },
};
