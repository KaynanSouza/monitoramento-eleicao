/** Implementação de `SqlDb` sobre node:sqlite, para testar o SQL real sem o app. */
import { DatabaseSync } from 'node:sqlite';
import { migrar, type SqlDb, type SqlParam } from '@/db/sql';

export async function bancoEmMemoria(): Promise<SqlDb> {
  const d = new DatabaseSync(':memory:');
  const db: SqlDb = {
    async execAsync(sql) {
      d.exec(sql);
    },
    async runAsync(sql, params: SqlParam[]) {
      return d.prepare(sql).run(...params);
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[]) {
      return (d.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: SqlParam[]) {
      return d.prepare(sql).all(...params) as T[];
    },
  };
  await migrar(db);
  return db;
}
