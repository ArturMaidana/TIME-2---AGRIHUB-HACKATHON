import { createServer } from 'node:http';
import { app } from './app.js';

const port = Number(process.env.PORT || 3001);

createServer(app).listen(port, () => {
  console.log(`AgriHub em http://localhost:${port}`);
});
