import { gastosPorCategoria, itensComprados } from '@dragometro/armazenamento';
import { categoria, itemDoSubitem } from '@dragometro/classificacao';
import {
  chaveCategoria,
  indicePorCategoria,
  observacoesDeItens,
  pesosPorGasto,
  type PontoSerie,
} from '@dragometro/core';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface GastoAgrupado {
  /** Código do "item" do IBGE (4 dígitos, ex.: 1107 = Carnes), ou null = sem categoria. */
  codigo: string | null;
  nome: string;
  gasto: number;
  /** Fração do total gasto (0,25 = 25%). */
  fracao: number;
}

export interface ResumoInflacao {
  /** Meses (AAAA-MM) com cupons. */
  meses: string[];
  /** Inflação pessoal mês a mês (precisa de pelo menos 2 meses). */
  serie: PontoSerie[];
  gastos: GastoAgrupado[];
}

/**
 * Junta o que a tela "Minha inflação" precisa.
 * Pesos: participação de cada subitem no gasto de todos os cupons guardados
 * (um "orçamento familiar" pessoal, no papel que a POF tem no IPCA).
 */
export async function resumoInflacao(db: SQLiteDatabase): Promise<ResumoInflacao> {
  const itens = await itensComprados(db);
  const meses = [...new Set(itens.map((i) => i.data.slice(0, 7)))].sort();
  const serie =
    itens.length > 0 ? indicePorCategoria(observacoesDeItens(itens), pesosPorGasto(itens, chaveCategoria), 'mes') : [];

  const porItem = new Map<string | null, number>();
  for (const g of await gastosPorCategoria(db)) {
    const codigo = g.subitem ? (itemDoSubitem(g.subitem)?.codigo ?? null) : null;
    porItem.set(codigo, (porItem.get(codigo) ?? 0) + g.gasto);
  }
  const total = [...porItem.values()].reduce((s, v) => s + v, 0);
  const gastos = [...porItem]
    .map(([codigo, gasto]) => ({
      codigo,
      nome: codigo ? (categoria(codigo)?.nome ?? codigo) : 'Sem categoria',
      gasto,
      fracao: total > 0 ? gasto / total : 0,
    }))
    .sort((a, b) => (a.codigo === null ? 1 : b.codigo === null ? -1 : b.gasto - a.gasto));

  return { meses, serie, gastos };
}
