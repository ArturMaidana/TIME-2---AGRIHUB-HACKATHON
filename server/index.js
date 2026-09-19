import { createServer } from 'node:http';
import { app } from './app.js';
import { appConfig } from './config/app-config.js';
import { runMigrations } from './database/migrate.js';
import { seedDatabase } from './database/seed.js';

async function start() {
  await runMigrations();
  await seedDatabase();
  createServer(app).listen(appConfig.port, () => {
    console.log(`AgriHub em http://localhost:${appConfig.port}`);
  });
}

start().catch((error) => {
  console.error('Falha ao iniciar o AgriHub', error);
  process.exit(1);
});
