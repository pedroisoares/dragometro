/**
 * Números como o OCR os leu: só os dígitos e quantas casas decimais o número tem.
 * Guardar os dígitos (e não o valor) permite medir "quão longe" um valor está do que
 * foi lido, contando dígitos trocados, sobrando ou faltando.
 */
export interface NumeroLido {
  /** Dígitos lidos, sem separador. `?` marca um caractere que não deu para entender. */
  digitos: string;
  /** Casas decimais: pelo separador lido ou, sem ele, o padrão do campo. */
  casas: number;
}

/** Letras e símbolos que o OCR troca por dígitos quando o contexto é numérico. */
const CONFUSOES: Record<string, string> = {
  O: '0', o: '0', Q: '0', D: '0', U: '0', C: '0', c: '0',
  I: '1', l: '1', i: '1', '|': '1', '!': '1', L: '1',
  Z: '2', z: '2',
  S: '5', s: '5',
  G: '6', b: '6',
  T: '7',
  B: '8', '&': '8',
  g: '9', q: '9',
};

/** Troca as letras confundíveis por dígitos. O que não for confundível vira `?`. */
export function comoDigitos(texto: string): string {
  return [...texto].map((c) => (/\d/.test(c) ? c : (CONFUSOES[c] ?? '?'))).join('');
}

/** Valor de um número lido, ou `NaN` se algum dígito não foi entendido. */
export function valorDe(n: NumeroLido): number {
  if (!n.digitos || n.digitos.includes('?')) return Number.NaN;
  return Number(n.digitos) / 10 ** n.casas;
}

/** Dígitos de um valor, com as casas do campo: 2,73 com 2 casas → "273". */
export function digitosDe(valor: number, casas: number): string {
  return String(Math.round(valor * 10 ** casas)).padStart(casas + 1, '0');
}

/**
 * Lê um número do OCR. Aceita vírgula ou ponto como separador; um espaço também vale
 * como separador quando o último grupo tem exatamente as casas esperadas ("4 90" → 4,90).
 * Sem separador, usa as casas padrão do campo ("1890" como preço → 18,90).
 */
export function lerNumero(texto: string, casasPadrao: number): NumeroLido | undefined {
  // Sinais que o OCR gruda nas pontas: "=", ":", "%", aspas, "«". "?" fica: é um dígito ilegível.
  const limpo = texto.replace(/^[^0-9A-Za-z&|!?]+|[^0-9A-Za-z&|!?,.]+$/g, '').replace(/[,.]+$/, '');
  if (!limpo) return undefined;

  const grupos = limpo.split(/\s+/);
  const ultimoGrupo = grupos.at(-1)!;
  let inteiro: string;
  let decimal: string;
  const sep = Math.max(limpo.lastIndexOf(','), limpo.lastIndexOf('.'));
  if (sep >= 0) {
    inteiro = limpo.slice(0, sep);
    decimal = limpo.slice(sep + 1);
  } else if (grupos.length > 1 && comoDigitos(ultimoGrupo).length === casasPadrao) {
    inteiro = grupos.slice(0, -1).join('');
    decimal = ultimoGrupo;
  } else {
    const tudo = comoDigitos(limpo.replace(/\s+/g, ''));
    return tudo.replace(/\?/g, '') ? { digitos: tudo, casas: casasPadrao } : undefined;
  }
  const d = comoDigitos(inteiro.replace(/[\s,.]+/g, ''));
  const c = comoDigitos(decimal.replace(/\s+/g, ''));
  const digitos = (d || '0') + c;
  if (!/\d/.test(digitos)) return undefined;
  return { digitos, casas: c.length };
}

/** Distância de edição (Levenshtein): trocas, sobras e faltas de caracteres. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length]!;
}

/** Variações de um número lido com até uma edição (um dígito trocado, sobrando ou faltando). */
export function variacoes(n: NumeroLido): { valor: number; custo: number }[] {
  const vistos = new Map<string, number>();
  const anotar = (d: string, custo: number) => {
    if (!d || d.includes('?')) return;
    if (!vistos.has(d) || vistos.get(d)! > custo) vistos.set(d, custo);
  };
  const s = n.digitos;
  anotar(s, 0);
  for (let i = 0; i <= s.length; i++) {
    for (const dig of '0123456789') {
      if (i < s.length && dig !== s[i]) anotar(s.slice(0, i) + dig + s.slice(i + 1), 1);
      anotar(s.slice(0, i) + dig + s.slice(i), 1);
    }
    if (i < s.length) anotar(s.slice(0, i) + s.slice(i + 1), 1);
  }
  return [...vistos].map(([d, custo]) => ({ valor: Number(d) / 10 ** n.casas, custo })).filter((v) => v.valor > 0);
}
