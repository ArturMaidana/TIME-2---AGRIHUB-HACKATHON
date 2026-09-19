import { db, databaseFile } from '../config/database.js';

const tables = ['units', 'users', 'sectors', 'shifts', 'totens', 'responses', 'hr_indicators'];
const counts = Object.fromEntries(tables.map((table) => [
  table,
  db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total,
]));

console.log(JSON.stringify({ database: databaseFile, persistent: databaseFile !== ':memory:', counts }, null, 2));
db.close();
