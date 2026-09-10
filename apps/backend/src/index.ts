import { createApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';

const port = process.env.PORT ?? 3000;

const db = openDatabase();
migrate(db);

const app = createApp(db);

app.listen(port, () => {
  console.log(`metr-index backend listening on port ${port}`);
});
