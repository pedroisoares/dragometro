import { CATALOGO_BRUTO } from './catalogo';

export interface Categoria {
  /** Código do IBGE: 1 dígito = grupo, 2 = subgrupo, 4 = item, 7 = subitem. "0" = índice geral. */
  codigo: string;
  /** Código da categoria na API SIDRA (classificação 315), usado para buscar as séries. */
  sidra: string;
  nome: string;
}

const POR_CODIGO = new Map<string, Categoria>(
  CATALOGO_BRUTO.map(([codigo, sidra, nome]) => [codigo, { codigo, sidra, nome }]),
);

export const CODIGOS = {
  indiceGeral: '0',
  alimentacaoNoDomicilio: '11',
} as const;

/** Categoria pelo código do IBGE, ou `undefined` se não estiver no catálogo. */
export function categoria(codigo: string): Categoria | undefined {
  return POR_CODIGO.get(codigo);
}

/** Todas as categorias de um nível: 'subitem' (7 dígitos) ou 'item' (4 dígitos). */
export function categoriasDoNivel(nivel: 'item' | 'subitem'): Categoria[] {
  const tamanho = nivel === 'subitem' ? 7 : 4;
  return [...POR_CODIGO.values()].filter((c) => c.codigo.length === tamanho);
}

/**
 * O "item" do IBGE a que um subitem pertence (4 primeiros dígitos):
 * 1107089 (Patinho) → 1107 (Carnes). Útil para agrupar gastos.
 */
export function itemDoSubitem(codigoSubitem: string): Categoria | undefined {
  return categoria(codigoSubitem.slice(0, 4));
}
