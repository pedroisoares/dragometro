import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { BancoSQL } from '../src';

/** Adaptador do `node:sqlite` para a interface usada pelo app (expo-sqlite). Só para testes. */
export function bancoEmMemoria(): BancoSQL {
  const db = new DatabaseSync(':memory:');
  const p = (params: (string | number | null)[]) => params as SQLInputValue[];
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      const r = db.prepare(sql).run(...p(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync<T>(sql: string, params: (string | number | null)[]) {
      return (db.prepare(sql).get(...p(params)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: (string | number | null)[]) {
      return db.prepare(sql).all(...p(params)) as T[];
    },
    async withTransactionAsync(tarefa) {
      db.exec('BEGIN');
      try {
        await tarefa();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
