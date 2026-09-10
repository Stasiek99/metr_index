import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.resolve(import.meta.dirname, '../../data/db.sqlite');

export function openDatabase(
  dbPath: string = process.env.DB_PATH ?? DEFAULT_DB_PATH,
): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
