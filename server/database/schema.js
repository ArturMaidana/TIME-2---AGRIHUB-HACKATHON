export function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,role TEXT NOT NULL,name TEXT NOT NULL,code TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS sectors(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'FRIA',active INTEGER DEFAULT 1,UNIQUE(unit_id,name));
    CREATE TABLE IF NOT EXISTS user_sectors(user_id TEXT NOT NULL,sector_id TEXT NOT NULL,PRIMARY KEY(user_id,sector_id));
    CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,UNIQUE(unit_id,name));
    CREATE TABLE IF NOT EXISTS totens(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,name TEXT NOT NULL,credential TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,sector_id TEXT NOT NULL,shift_id TEXT NOT NULL,response_date TEXT NOT NULL,metric TEXT NOT NULL,score INTEGER NOT NULL,quantity INTEGER NOT NULL DEFAULT 1,UNIQUE(unit_id,sector_id,shift_id,response_date,metric,score));
    CREATE TABLE IF NOT EXISTS hr_indicators(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,sector_id TEXT NOT NULL,shift_id TEXT NOT NULL,period TEXT NOT NULL,overtime REAL NOT NULL,absences INTEGER NOT NULL,leaves INTEGER NOT NULL,leave_reason TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_responses_scope ON responses(unit_id,sector_id,shift_id,response_date);
    CREATE INDEX IF NOT EXISTS idx_hr_scope ON hr_indicators(unit_id,sector_id,shift_id,period);
  `);
}
