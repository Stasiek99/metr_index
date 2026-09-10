import express from 'express';
import { createPricesRouter } from './api/pricesRouter.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';

const app = express();
const port = process.env.PORT ?? 3000;

const db = openDatabase();
migrate(db);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', createPricesRouter(db));

app.listen(port, () => {
  console.log(`metr-index backend listening on port ${port}`);
});
