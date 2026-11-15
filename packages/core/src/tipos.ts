/** Unidades em que um preço pode ser comparado. */
export type UnidadeBase = 'un' | 'kg' | 'l';

/** Unidades que aparecem nos cupons e nas descrições de produtos. */
export type Unidade = UnidadeBase | 'g' | 'ml';

/** Data no formato ISO `AAAA-MM-DD`. */
export type DataISO = string;

/**
 * Um item comprado, como vem do cupom fiscal depois de normalizado.
 * `produtoId` identifica o "mesmo produto" entre compras diferentes
 * (de preferência o código de barras/EAN; na falta dele, uma chave criada pelo app).
 */
export interface ItemComprado {
  produtoId: string;
  descricao: string;
  data: DataISO;
  quantidade: number;
  /** Unidade da quantidade cobrada no cupom (UN, KG, L...). */
  unidade: Unidade;
  valorUnitario: number;
  valorTotal: number;
  /** Categoria (subitem do IPCA, por exemplo `1101002 - Arroz`), quando já classificado. */
  categoria?: string;
}

/** Um preço observado, já convertido para uma unidade comparável. */
export interface ObservacaoPreco {
  produtoId: string;
  data: DataISO;
  /** Preço por unidade base (R$/un, R$/kg ou R$/L). */
  preco: number;
}

export type Granularidade = 'semana' | 'mes' | 'ano';

/** Um ponto de uma série de inflação. Variações são frações: 0,05 = 5%. */
export interface PontoSerie {
  periodo: string;
  variacao: number;
  acumulado: number;
}
