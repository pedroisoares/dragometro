export type ValorSQL = string | number | null;

/**
 * O pedaço da API do `SQLiteDatabase` (expo-sqlite) que usamos.
 * No app, passe o banco do `useSQLiteContext()`; nos testes, um adaptador do `node:sqlite`.
 */
export interface BancoSQL {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: ValorSQL[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, params: ValorSQL[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: ValorSQL[]): Promise<T[]>;
  withTransactionAsync(tarefa: () => Promise<void>): Promise<void>;
}

import { classificar } from '@dragometro/classificacao';

const VERSAO_ATUAL = 3;

/** Esquema da versão 1 (exportado só para os testes de migração). */
export const ESQUEMA_V1 = `
  CREATE TABLE notas (
    chave          TEXT PRIMARY KEY NOT NULL,
    uf             TEXT NOT NULL,
    cnpj_emitente  TEXT NOT NULL,
    nome_emitente  TEXT,
    data_emissao   TEXT NOT NULL,
    valor_total    REAL,
    lida_em        TEXT NOT NULL
  );
  CREATE TABLE itens (
    id              INTEGER PRIMARY KEY NOT NULL,
    chave_nota      TEXT NOT NULL REFERENCES notas(chave) ON DELETE CASCADE,
    ordem           INTEGER NOT NULL,
    produto_id      TEXT NOT NULL,
    codigo          TEXT,
    descricao       TEXT NOT NULL,
    quantidade      REAL NOT NULL,
    unidade         TEXT NOT NULL,
    valor_unitario  REAL NOT NULL,
    valor_total     REAL NOT NULL
  );
  CREATE INDEX itens_produto ON itens(produto_id);
  CREATE INDEX itens_nota ON itens(chave_nota);
  CREATE INDEX notas_data ON notas(data_emissao);
`;

/**
 * Cria ou atualiza o esquema. Chame uma vez ao abrir o banco
 * (no app: `onInit` do `SQLiteProvider`).
 * Cada versão nova entra como mais um `if (versao < N)`, sem apagar dados.
 */
export async function migrar(db: BancoSQL): Promise<void> {
  // Configurações de conexão ficam fora da transação.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const versao = linha?.user_version ?? 0;
  if (versao > VERSAO_ATUAL) {
    throw new Error('O banco é de uma versão mais nova do app. Atualize o Dragômetro.');
  }
  if (versao === VERSAO_ATUAL) return;

  await db.withTransactionAsync(async () => {
    if (versao < 1) {
      await db.execAsync(ESQUEMA_V1);
    }
    if (versao < 2) {
      // v2: subitem do IPCA de cada item, e classificação dos itens já guardados.
      await db.execAsync(`
        ALTER TABLE itens ADD COLUMN subitem TEXT;
        CREATE INDEX itens_subitem ON itens(subitem);
      `);
      const itens = await db.getAllAsync<{ id: number; descricao: string }>('SELECT id, descricao FROM itens', []);
      for (const item of itens) {
        const cat = classificar(item.descricao);
        if (cat) await db.runAsync('UPDATE itens SET subitem = ? WHERE id = ?', [cat.codigo, item.id]);
      }
    }
    if (versao < 3) {
      // v3: de onde veio a nota. 'sefaz' (QR Code ou chave) ou 'foto' (itens lidos da foto,
      // com chave criada pelo app e loja identificada pelo nome quando não há CNPJ).
      await db.execAsync(`ALTER TABLE notas ADD COLUMN origem TEXT NOT NULL DEFAULT 'sefaz';`);
    }
    await db.execAsync(`PRAGMA user_version = ${VERSAO_ATUAL}`);
  });
}
