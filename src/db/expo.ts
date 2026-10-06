import * as SQLite from 'expo-sqlite';
import { migrar, type SqlDb } from './sql';

/** Abre (e migra) o banco local. Replay usa um arquivo separado para não misturar históricos. */
export async function abrirBanco(nome: string): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(nome);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrar(db);
  return db;
}
