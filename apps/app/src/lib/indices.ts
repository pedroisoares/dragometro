import { variacaoMensal, type Indice } from '@dragometro/ibge';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Variação mensal de um índice oficial nos últimos meses.
 * Na Web, quando a API está configurada, busca por ela (evita problemas de CORS com o IBGE).
 */
export async function buscarIndice(indice: Indice, ultimos = 12): Promise<Map<string, number>> {
  if (Platform.OS === 'web' && API_URL) {
    const resposta = await fetch(`${API_URL}/indices/${indice}?ultimos=${ultimos}`);
    if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}`);
    const { serie } = (await resposta.json()) as { serie: Record<string, number> };
    return new Map(Object.entries(serie));
  }
  return variacaoMensal(indice, { ultimos });
}
