export function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('SUPERVISOR','RH')),name TEXT NOT NULL,code TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS sectors(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'FRIA' CHECK(category IN ('QUENTE','FRIA')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),UNIQUE(unit_id,name));
    CREATE TABLE IF NOT EXISTS user_sectors(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,PRIMARY KEY(user_id,sector_id));
    CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,name TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,UNIQUE(unit_id,name));
    CREATE TABLE IF NOT EXISTS totens(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,name TEXT NOT NULL,credential TEXT UNIQUE NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,response_date TEXT NOT NULL,metric TEXT NOT NULL CHECK(metric IN ('ENERGY','PHYSICAL','STRESS')),score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),UNIQUE(unit_id,sector_id,shift_id,response_date,metric,score));
    CREATE TABLE IF NOT EXISTS hr_indicators(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,period TEXT NOT NULL,absences INTEGER NOT NULL CHECK(absences >= 0),leaves INTEGER NOT NULL CHECK(leaves >= 0),created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_responses_scope ON responses(unit_id,sector_id,shift_id,response_date);
    CREATE INDEX IF NOT EXISTS idx_hr_scope ON hr_indicators(unit_id,sector_id,shift_id,period);
  `);

  db.prepare('INSERT OR IGNORE INTO schema_migrations VALUES(?, ?, ?)')
    .run(1, 'baseline_relacional', new Date().toISOString());
}
