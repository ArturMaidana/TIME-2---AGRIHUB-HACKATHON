import { randomUUID } from 'node:crypto';
import { STANDARD_SECTORS } from './migrations.js';

const SHIFTS = [
  ['t1', 'Manhã', '06:00', '14:20'], ['t2', 'Tarde', '14:20', '22:35'],
  ['t3', 'Noite', '22:35', '06:00'],
];

function seedResponses(db, sectorStart = 0) {
  const insert = db.prepare('INSERT OR IGNORE INTO responses VALUES(?, ?, ?, ?, ?, ?, ?, ?)');
  const today = new Date();
  for (let day = 34; day >= 0; day -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - day);
    if ([0, 6].includes(date.getDay())) continue;
    const dateKey = date.toISOString().slice(0, 10);
    for (let index = sectorStart; index < STANDARD_SECTORS.length; index += 1) {
      for (const metric of ['ENERGY', 'PHYSICAL', 'STRESS']) {
        const base = metric === 'ENERGY' ? 3.9 - index * 0.07 : 2 + index * 0.08;
        for (let score = 1; score <= 5; score += 1) {
          const quantity = Math.max(0, Math.round(8 - Math.abs(score - (base + Math.sin(day / 4) * 0.25)) * 3));
          if (quantity) insert.run(randomUUID(), 'u1', STANDARD_SECTORS[index][0], SHIFTS[day % 2][0], dateKey, metric, score, quantity);
        }
      }
    }
  }
}

export function seedDatabase(db) {
  if (!db.prepare('SELECT id FROM units LIMIT 1').get()) {
    db.prepare('INSERT INTO units VALUES(?, ?, ?)').run('u1', 'Frigorífico Vale Verde', 'America/Cuiaba');
    db.prepare('INSERT INTO users VALUES(?, ?, ?, ?, ?)').run('sup1', 'u1', 'SUPERVISOR', 'Marina Alves', 'SUPERVISOR');
    db.prepare('INSERT INTO users VALUES(?, ?, ?, ?, ?)').run('rh1', 'u1', 'RH', 'Equipe de RH', 'RH2026');
    for (const [id, name, category] of STANDARD_SECTORS) {
      db.prepare('INSERT INTO sectors(id, unit_id, name, category) VALUES(?, ?, ?, ?)').run(id, 'u1', name, category);
      db.prepare('INSERT INTO user_sectors VALUES(?, ?)').run('sup1', id);
    }
    for (const shift of SHIFTS) db.prepare('INSERT INTO shifts VALUES(?, ?, ?, ?, ?)').run(shift[0], 'u1', shift[1], shift[2], shift[3]);
    db.prepare('INSERT INTO totens VALUES(?, ?, ?, ?, 1)').run('tot1', 'u1', 'Entrada principal', 'TOTEM-01');
    seedResponses(db);
    const insertHr = db.prepare('INSERT INTO hr_indicators VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const today = new Date();
    for (let week = 4; week >= 0; week -= 1) {
      const date = new Date(today); date.setDate(today.getDate() - week * 7);
      for (let index = 0; index < STANDARD_SECTORS.length; index += 1) {
        insertHr.run(randomUUID(), 'u1', STANDARD_SECTORS[index][0], 't1', date.toISOString().slice(0, 10), 0, 2 + index, index % 3, '', new Date().toISOString());
      }
    }
  } else if (db.prepare("SELECT COUNT(*) total FROM responses WHERE sector_id = 's5'").get().total === 0) {
    seedResponses(db, 4);
  }
}
