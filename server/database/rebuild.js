import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { db as currentDatabase, databaseFile, openDatabase } from '../config/database.js';

if (databaseFile === ':memory:') throw new Error('Não é possível recriar um banco em memória.');

currentDatabase.close();

if (existsSync(databaseFile)) {
  const backup = `${databaseFile}.backup`;
  copyFileSync(databaseFile, backup);
  rmSync(databaseFile);
  for (const suffix of ['-shm', '-wal']) {
    if (existsSync(`${databaseFile}${suffix}`)) rmSync(`${databaseFile}${suffix}`);
  }
  console.log(`Backup criado em ${backup}`);
}

const db = openDatabase(databaseFile);
db.close();
console.log(`Banco recriado e populado em ${databaseFile}`);
