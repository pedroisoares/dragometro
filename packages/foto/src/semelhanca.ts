import { distancia } from './numeros';

/** Só letras e dígitos, maiúsculas, sem acentos e sem espaços: "Acel ga und" → "ACELGAUND". */
export function chaveDeComparacao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Semelhança entre dois textos lidos pelo OCR, de 0 a 1. Ignora espaços, acentos e
 * pontuação, que o OCR muda de uma foto para outra ("ACEL GA UND" = "ACELGA UND").
 */
export function semelhanca(a: string, b: string): number {
  const x = chaveDeComparacao(a);
  const y = chaveDeComparacao(b);
  if (!x || !y) return 0;
  return 1 - distancia(x, y) / Math.max(x.length, y.length);
}

/** O mais parecido de uma lista, se passar do mínimo (padrão 0,85). */
export function maisParecido<T>(texto: string, opcoes: T[], textoDe: (o: T) => string, minimo = 0.85): T | undefined {
  let melhor: T | undefined;
  let nota = minimo;
  for (const o of opcoes) {
    const s = semelhanca(texto, textoDe(o));
    if (s >= nota) {
      melhor = o;
      nota = s;
    }
  }
  return melhor;
}
