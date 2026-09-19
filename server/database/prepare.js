import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

await runMigrations();
await seedDatabase();
console.log('Banco migrado e populado.');
process.exit(0);
