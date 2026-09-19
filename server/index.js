import { createServer } from 'node:http';
import { app } from './app.js';
import { appConfig } from './config/app-config.js';

createServer(app).listen(appConfig.port, () => {
  console.log(`AgriHub em http://localhost:${appConfig.port}`);
});
