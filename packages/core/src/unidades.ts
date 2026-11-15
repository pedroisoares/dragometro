import type { Unidade, UnidadeBase } from './tipos';

export interface Embalagem {
  quantidade: number;
  unidade: UnidadeBase;
}

const FATOR: Record<Unidade, { base: UnidadeBase; fator: number }> = {
  un: { base: 'un', fator: 1 },
  kg: { base: 'kg', fator: 1 },
  g: { base: 'kg', fator: 0.001 },
  l: { base: 'l', fator: 1 },
  ml: { base: 'l', fator: 0.001 },
};

/** Converte uma quantidade para a unidade base (g → kg, ml → L). */
export function paraUnidadeBase(quantidade: number, unidade: Unidade): Embalagem {
  const { base, fator } = FATOR[unidade];
  return { quantidade: quantidade * fator, unidade: base };
}

/** Converte a unidade escrita no cupom ("UN", "KG", "LT", "PCT"...) para uma `Unidade`. */
export function lerUnidadeCupom(texto: string): Unidade {
  const t = texto.trim().toLowerCase();
  if (['kg', 'kgs', 'quilo'].includes(t)) return 'kg';
  if (['g', 'gr', 'grs'].includes(t)) return 'g';
  if (['l', 'lt', 'lts', 'litro'].includes(t)) return 'l';
  if (['ml'].includes(t)) return 'ml';
  // UN, UND, PC, PCT, CX, FD... são tratados como unidade.
  return 'un';
}

const REGEX_EMBALAGEM = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml)\b/gi;

/**
 * Procura o tamanho da embalagem na descrição do produto.
 * Ex.: "LEITE UHT INTEGRAL 1L" → 1 L; "CAFE TORRADO 500G" → 0,5 kg.
 * Retorna `undefined` se não encontrar. Se houver multiplicador ("6X1L"), ele é aplicado.
 */
export function extrairEmbalagem(descricao: string): Embalagem | undefined {
  const matches = [...descricao.matchAll(REGEX_EMBALAGEM)];
  const ultimo = matches.at(-1);
  if (!ultimo || !ultimo[1] || !ultimo[2]) return undefined;

  const valor = Number(ultimo[1].replace(',', '.'));
  const unidade = lerUnidadeCupom(ultimo[2]);
  let embalagem = paraUnidadeBase(valor, unidade);

  const antes = descricao.slice(0, ultimo.index);
  const mult = /(\d+)\s*x\s*$/i.exec(antes);
  if (mult?.[1]) {
    embalagem = { ...embalagem, quantidade: embalagem.quantidade * Number(mult[1]) };
  }
  return embalagem;
}

/**
 * Preço por unidade base (R$/kg, R$/L ou R$/un) de um item do cupom.
 * - Item vendido por peso/volume (KG, L): o preço unitário já é por unidade base.
 * - Item vendido por unidade com tamanho na descrição ("LEITE 1L"): divide pelo tamanho.
 * - Caso contrário: preço por unidade.
 */
export function precoPorUnidadeBase(
  valorUnitario: number,
  unidadeCupom: Unidade,
  descricao = '',
): { preco: number; unidade: UnidadeBase } {
  if (unidadeCupom !== 'un') {
    const { quantidade, unidade } = paraUnidadeBase(1, unidadeCupom);
    return { preco: valorUnitario / quantidade, unidade };
  }
  const embalagem = extrairEmbalagem(descricao);
  if (embalagem && embalagem.quantidade > 0) {
    return { preco: valorUnitario / embalagem.quantidade, unidade: embalagem.unidade };
  }
  return { preco: valorUnitario, unidade: 'un' };
}
