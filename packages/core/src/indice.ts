import { chavePeriodo } from './periodo';
import type { Granularidade, ItemComprado, ObservacaoPreco, PontoSerie } from './tipos';
import { lerUnidadeCupom, precoPorUnidadeBase } from './unidades';
import { mediaGeometrica } from './variacao';

/** Converte itens do cupom em observações de preço comparáveis (R$/kg, R$/L ou R$/un). */
export function observacoesDeItens(itens: readonly ItemComprado[]): ObservacaoPreco[] {
  return itens.map((item) => ({
    produtoId: item.produtoId,
    data: item.data,
    preco: precoPorUnidadeBase(item.valorUnitario, lerUnidadeCupom(item.unidade), item.descricao).preco,
    ...(item.categoria ? { categoria: item.categoria } : {}),
  }));
}

/**
 * Preço de cada produto em cada período: média geométrica de todas as compras
 * do produto naquele período (como o IBGE faz com os preços coletados).
 * Retorna `Map<produtoId, Map<periodo, preco>>`, com os períodos em ordem.
 */
export function precosPorPeriodo(
  observacoes: readonly ObservacaoPreco[],
  granularidade: Granularidade,
): Map<string, Map<string, number>> {
  const agrupado = new Map<string, Map<string, number[]>>();
  for (const obs of observacoes) {
    const periodo = chavePeriodo(obs.data, granularidade);
    const porPeriodo = agrupado.get(obs.produtoId) ?? new Map<string, number[]>();
    porPeriodo.set(periodo, [...(porPeriodo.get(periodo) ?? []), obs.preco]);
    agrupado.set(obs.produtoId, porPeriodo);
  }

  const resultado = new Map<string, Map<string, number>>();
  for (const [produtoId, porPeriodo] of agrupado) {
    const ordenado = [...porPeriodo.entries()].sort(([a], [b]) => a.localeCompare(b));
    resultado.set(produtoId, new Map(ordenado.map(([p, precos]) => [p, mediaGeometrica(precos)])));
  }
  return resultado;
}

export interface VariacaoItem {
  periodo: string;
  preco: number;
  /** Variação em relação ao período anterior em que o produto foi comprado (undefined no primeiro). */
  variacao?: number;
  /** Variação acumulada desde a primeira compra. */
  acumulado: number;
}

/** Série de preços e variações de um produto, por semana, mês ou ano. */
export function variacaoDoItem(
  observacoes: readonly ObservacaoPreco[],
  produtoId: string,
  granularidade: Granularidade,
): VariacaoItem[] {
  const precos = precosPorPeriodo(
    observacoes.filter((o) => o.produtoId === produtoId),
    granularidade,
  ).get(produtoId);
  if (!precos) return [];

  const serie: VariacaoItem[] = [];
  let primeiro: number | undefined;
  let anterior: number | undefined;
  for (const [periodo, preco] of precos) {
    primeiro ??= preco;
    serie.push({
      periodo,
      preco,
      variacao: anterior === undefined ? undefined : preco / anterior - 1,
      acumulado: preco / primeiro - 1,
    });
    anterior = preco;
  }
  return serie;
}

/**
 * Pesos de cada produto (ou categoria) pela participação no gasto total.
 * Use os itens de um período-base (por exemplo, os 3 primeiros meses de cupons).
 */
export function pesosPorGasto(
  itens: readonly ItemComprado[],
  chave: (item: ItemComprado) => string = (i) => i.produtoId,
): Map<string, number> {
  const gastos = new Map<string, number>();
  let total = 0;
  for (const item of itens) {
    const k = chave(item);
    gastos.set(k, (gastos.get(k) ?? 0) + item.valorTotal);
    total += item.valorTotal;
  }
  if (total <= 0) throw new Error('Gasto total precisa ser maior que zero');
  return new Map([...gastos].map(([k, g]) => [k, g / total]));
}

/**
 * Índice de inflação pessoal pelo Laspeyres modificado, o mesmo esquema do IPCA/INPC:
 *
 *   I_t = Σ w_i,t−1 × (p_i,t / p_i,t−1)
 *   w_i,t = w_i,t−1 × (p_i,t / p_i,t−1) / I_t
 *
 * Os pesos partem de `pesosIniciais` (participação no gasto) e são atualizados a cada
 * período pela variação relativa de preço. Produto sem preço em t−1 ou t fica fora do
 * cálculo naquele período, e os pesos dos demais são reescalados (equivale a imputar
 * para ele a variação média — o IBGE faz algo parecido dentro de cada grupo).
 *
 * Retorna a série a partir do segundo período com preços.
 */
export function indicePessoal(
  observacoes: readonly ObservacaoPreco[],
  pesosIniciais: ReadonlyMap<string, number>,
  granularidade: Granularidade = 'mes',
): PontoSerie[] {
  const precos = precosPorPeriodo(
    observacoes.filter((o) => pesosIniciais.has(o.produtoId)),
    granularidade,
  );
  const periodos = [...new Set([...precos.values()].flatMap((m) => [...m.keys()]))].sort();

  const pesos = new Map(pesosIniciais);
  const serie: PontoSerie[] = [];
  let acumulado = 1;

  for (let t = 1; t < periodos.length; t++) {
    const anterior = periodos[t - 1]!;
    const atual = periodos[t]!;

    const relativos = new Map<string, number>();
    for (const [produtoId, porPeriodo] of precos) {
      const p0 = porPeriodo.get(anterior);
      const p1 = porPeriodo.get(atual);
      if (p0 !== undefined && p1 !== undefined) relativos.set(produtoId, p1 / p0);
    }
    if (relativos.size === 0) continue;

    let somaPesos = 0;
    let somaPonderada = 0;
    for (const [produtoId, r] of relativos) {
      const w = pesos.get(produtoId) ?? 0;
      somaPesos += w;
      somaPonderada += w * r;
    }
    if (somaPesos === 0) continue;
    const indice = somaPonderada / somaPesos;

    for (const [produtoId, r] of relativos) {
      pesos.set(produtoId, ((pesos.get(produtoId) ?? 0) * r) / indice);
    }

    acumulado *= indice;
    serie.push({ periodo: atual, variacao: indice - 1, acumulado: acumulado - 1 });
  }
  return serie;
}

export interface Comparacao {
  periodo: string;
  pessoal: number;
  oficial: number;
  /** Diferença em pontos percentuais (fração): pessoal − oficial. */
  diferenca: number;
}

/** Compara a inflação pessoal com uma série oficial (IPCA, INPC) nos períodos em comum. */
export function compararComOficial(
  pessoal: readonly PontoSerie[],
  oficial: ReadonlyMap<string, number>,
): Comparacao[] {
  return pessoal
    .filter((p) => oficial.has(p.periodo))
    .map((p) => {
      const o = oficial.get(p.periodo)!;
      return { periodo: p.periodo, pessoal: p.variacao, oficial: o, diferenca: p.variacao - o };
    });
}

/**
 * Chave usada para agrupar no índice por categoria: o subitem do IPCA quando existe;
 * sem classificação, o produto vira uma categoria sozinho (para não sumir do índice).
 */
export function chaveCategoria(x: { produtoId: string; categoria?: string }): string {
  return x.categoria ?? `produto:${x.produtoId}`;
}

/**
 * Índice pessoal com a mesma estrutura do IPCA:
 *
 * 1. Dentro de cada categoria (subitem), os relativos de preço dos produtos comprados
 *    nos dois períodos são juntados por média geométrica (Jevons). Assim o leite da
 *    loja A e o leite da loja B entram juntos em "Leite longa vida".
 * 2. Entre categorias, Laspeyres modificado com pesos pela participação no gasto,
 *    atualizados a cada período pela variação da categoria.
 *
 * `pesosIniciais` usa as chaves de `chaveCategoria` (veja `pesosPorGasto(itens, chaveCategoria)`).
 */
export function indicePorCategoria(
  observacoes: readonly ObservacaoPreco[],
  pesosIniciais: ReadonlyMap<string, number>,
  granularidade: Granularidade = 'mes',
): PontoSerie[] {
  const categoriaDoProduto = new Map<string, string>();
  for (const o of observacoes) categoriaDoProduto.set(o.produtoId, chaveCategoria(o));

  const precos = precosPorPeriodo(
    observacoes.filter((o) => pesosIniciais.has(chaveCategoria(o))),
    granularidade,
  );
  const periodos = [...new Set([...precos.values()].flatMap((m) => [...m.keys()]))].sort();

  const pesos = new Map(pesosIniciais);
  const serie: PontoSerie[] = [];
  let acumulado = 1;

  for (let t = 1; t < periodos.length; t++) {
    const anterior = periodos[t - 1]!;
    const atual = periodos[t]!;

    // Relativos de cada produto, agrupados por categoria.
    const relativosPorCategoria = new Map<string, number[]>();
    for (const [produtoId, porPeriodo] of precos) {
      const p0 = porPeriodo.get(anterior);
      const p1 = porPeriodo.get(atual);
      if (p0 === undefined || p1 === undefined) continue;
      const cat = categoriaDoProduto.get(produtoId)!;
      relativosPorCategoria.set(cat, [...(relativosPorCategoria.get(cat) ?? []), p1 / p0]);
    }
    if (relativosPorCategoria.size === 0) continue;

    // Jevons dentro da categoria; Laspeyres entre categorias.
    const relativos = new Map([...relativosPorCategoria].map(([cat, rs]) => [cat, mediaGeometrica(rs)]));
    let somaPesos = 0;
    let somaPonderada = 0;
    for (const [cat, r] of relativos) {
      const w = pesos.get(cat) ?? 0;
      somaPesos += w;
      somaPonderada += w * r;
    }
    if (somaPesos === 0) continue;
    const indice = somaPonderada / somaPesos;
    for (const [cat, r] of relativos) pesos.set(cat, ((pesos.get(cat) ?? 0) * r) / indice);

    acumulado *= indice;
    serie.push({ periodo: atual, variacao: indice - 1, acumulado: acumulado - 1 });
  }
  return serie;
}
