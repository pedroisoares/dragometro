import { itensComprados, listarProdutos, type ResumoProduto } from '@dragometro/armazenamento';
import {
  lerUnidadeCupom,
  observacoesDeItens,
  precoPorUnidadeBase,
  variacaoDoItem,
  type Granularidade,
  type UnidadeBase,
  type VariacaoItem,
} from '@dragometro/core';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface ProdutoComPreco extends ResumoProduto {
  precoAtual: number;
  unidade: UnidadeBase;
  /** Variação da última compra em relação à anterior (por semana). */
  ultimaVariacao?: number;
}

/** Produtos com o preço mais recente (R$/kg, R$/L ou R$/un) e a última variação. */
export async function produtosComPreco(db: SQLiteDatabase): Promise<ProdutoComPreco[]> {
  const [produtos, itens] = await Promise.all([listarProdutos(db), itensComprados(db)]);
  const observacoes = observacoesDeItens(itens);

  return produtos.map((p) => {
    const ultimoItem = itens.filter((i) => i.produtoId === p.produtoId).at(-1)!;
    const { unidade } = precoPorUnidadeBase(ultimoItem.valorUnitario, lerUnidadeCupom(ultimoItem.unidade), ultimoItem.descricao);
    const serie = variacaoDoItem(observacoes, p.produtoId, 'semana');
    const ultimo = serie.at(-1);
    return { ...p, precoAtual: ultimo?.preco ?? 0, unidade, ultimaVariacao: ultimo?.variacao };
  });
}

export interface DetalheProduto {
  descricao: string;
  unidade: UnidadeBase;
  serie: VariacaoItem[];
  /** Série mensal (para comparar com o IPCA, que é mensal), independente da aba escolhida. */
  serieMensal: VariacaoItem[];
  /** Subitem do IPCA do produto, quando classificado. */
  subitem?: string;
}

export async function detalheProduto(
  db: SQLiteDatabase,
  produtoId: string,
  granularidade: Granularidade,
): Promise<DetalheProduto | null> {
  const itens = await itensComprados(db, produtoId);
  const ultimo = itens.at(-1);
  if (!ultimo) return null;
  const { unidade } = precoPorUnidadeBase(ultimo.valorUnitario, lerUnidadeCupom(ultimo.unidade), ultimo.descricao);
  const observacoes = observacoesDeItens(itens);
  return {
    descricao: ultimo.descricao,
    unidade,
    serie: variacaoDoItem(observacoes, produtoId, granularidade),
    serieMensal: variacaoDoItem(observacoes, produtoId, 'mes'),
    subitem: ultimo.categoria,
  };
}
