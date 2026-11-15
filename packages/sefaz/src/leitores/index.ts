import type { LeitorSefaz, UF } from '../tipos';
import { layoutPadrao } from './layout-padrao';

/**
 * Leitores específicos por estado. Enquanto um estado não tiver o seu,
 * usamos o `layoutPadrao`.
 *
 * Para adicionar um estado:
 *   1. crie `src/leitores/<uf>.ts` exportando um `LeitorSefaz`;
 *   2. inclua-o na lista abaixo;
 *   3. salve uma página real em `test/fixtures/<uf>.html` e escreva o teste.
 */
const leitoresEspecificos: LeitorSefaz[] = [];

export function leitorPara(uf: UF): LeitorSefaz {
  return leitoresEspecificos.find((l) => l.ufs.includes(uf)) ?? layoutPadrao;
}

/** `true` se a leitura da SEFAZ deste estado já foi validada com páginas reais. */
export function estadoValidado(uf: UF): boolean {
  return [layoutPadrao, ...leitoresEspecificos].some((l) => l.ufs.includes(uf));
}

export { layoutPadrao };
