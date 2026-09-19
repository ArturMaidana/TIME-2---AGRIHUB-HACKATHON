const STANDARD_SECTORS = [
  ['s1', 'Desossa', 'FRIA'], ['s2', 'Embalagem secundária', 'FRIA'],
  ['s3', 'Abate primeira fase', 'QUENTE'], ['s4', 'Expedição caixaria', 'FRIA'],
  ['s5', 'Abate segunda fase', 'QUENTE'], ['s6', 'Miúdos', 'QUENTE'],
  ['s7', 'Bucharia limpa', 'QUENTE'], ['s8', 'Bucharia suja', 'QUENTE'],
  ['s9', 'Gracharia', 'QUENTE'], ['s10', 'Expedição com osso', 'FRIA'],
];

export function runMigrations(db) {
  const columns = db.prepare('PRAGMA table_info(sectors)').all();
  if (!columns.some((column) => column.name === 'category')) {
    db.exec("ALTER TABLE sectors ADD COLUMN category TEXT NOT NULL DEFAULT 'FRIA'");
  }
  if (!db.prepare("SELECT id FROM units WHERE id = 'u1'").get()) return;
  for (const [id, name, category] of STANDARD_SECTORS) {
    db.prepare(`
      INSERT INTO sectors(id, unit_id, name, category)
      VALUES(?, 'u1', ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category
    `).run(id, name, category);
    db.prepare('INSERT OR IGNORE INTO user_sectors VALUES(?, ?)').run('sup1', id);
  }
}

export { STANDARD_SECTORS };
