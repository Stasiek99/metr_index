import express from 'express';
import { errorHandler, notFoundHandler } from './api/errorHandler.js';
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

// Order matters: notFoundHandler only runs if nothing above matched, and errorHandler
// must be registered last — Express recognizes error-handling middleware by its 4-arg
// signature, but only picks it up for errors from middleware registered before it.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`metr-index backend listening on port ${port}`);
});
