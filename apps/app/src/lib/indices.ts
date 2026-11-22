import { variacaoMensal, variacaoMensalCategoria, type Indice } from '@dragometro/ibge';
import { Platform } from 'react-native';
import { urlDaApi } from './api';


async function viaApi(caminho: string): Promise<Map<string, number>> {
  const resposta = await fetch(`${urlDaApi()}${caminho}`);
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}`);
  const { serie } = (await resposta.json()) as { serie: Record<string, number> };
  return new Map(Object.entries(serie));
}

/**
 * Variação mensal de um índice oficial nos últimos meses.
 * Na Web, quando a API está configurada, busca por ela (evita problemas de CORS com o IBGE).
 */
export async function buscarIndice(indice: Indice, ultimos = 12): Promise<Map<string, number>> {
  if (Platform.OS === 'web' && urlDaApi()) return viaApi(`/indices/${indice}?ultimos=${ultimos}`);
  return variacaoMensal(indice, { ultimos });
}

/** Variação mensal de uma categoria do índice (pelo código SIDRA), ex.: "12393" = Leite longa vida. */
export async function buscarIndiceCategoria(
  indice: Indice,
  codigoSidra: string,
  ultimos = 12,
): Promise<Map<string, number>> {
  if (Platform.OS === 'web' && urlDaApi()) return viaApi(`/indices/${indice}/categoria/${codigoSidra}?ultimos=${ultimos}`);
  return variacaoMensalCategoria(indice, codigoSidra, { ultimos });
}
