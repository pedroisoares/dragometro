import { categoria, type Categoria } from './categorias';
import { REGRAS } from './regras';

/** Maiúsculas, sem acentos, pontuação vira espaço, espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Subitem do IPCA para a descrição de um item de cupom, ou `null` quando
 * nenhuma regra reconhece o produto (ou quando o produto não tem subitem no IPCA,
 * como creme de leite e batata palha).
 */
export function classificar(descricao: string): Categoria | null {
  const texto = normalizar(descricao);
  for (const [subitem, padrao] of REGRAS) {
    if (padrao.test(texto)) return subitem ? (categoria(subitem) ?? null) : null;
  }
  return null;
}
