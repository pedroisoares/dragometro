import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Carrega dados do banco local sempre que a tela ganha foco
 * (assim a lista se atualiza ao voltar da leitura de um cupom).
 */
export function useDados<T>(carregar: (db: SQLiteDatabase) => Promise<T>, chave = '') {
  const db = useSQLiteContext();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregar(db)
        .then((d) => ativo && setDados(d))
        .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : String(e)));
      return () => {
        ativo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, chave]),
  );

  return { dados, erro };
}
