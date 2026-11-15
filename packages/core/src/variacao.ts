/** Variação entre dois preços, como fração (0,05 = +5%). */
export function variacao(anterior: number, atual: number): number {
  if (anterior <= 0) throw new Error('Preço anterior precisa ser maior que zero');
  return atual / anterior - 1;
}

/** Acumula variações encadeadas: (1+v1)(1+v2)... − 1. */
export function acumular(variacoes: readonly number[]): number {
  return variacoes.reduce((acc, v) => acc * (1 + v), 1) - 1;
}

/** Média geométrica, usada pelo IBGE para juntar preços do mesmo produto (fórmula de Jevons). */
export function mediaGeometrica(valores: readonly number[]): number {
  if (valores.length === 0) throw new Error('Lista vazia');
  const somaLog = valores.reduce((acc, v) => {
    if (v <= 0) throw new Error('Valores precisam ser maiores que zero');
    return acc + Math.log(v);
  }, 0);
  return Math.exp(somaLog / valores.length);
}

/** Formata uma fração como porcentagem brasileira: 0,1234 → "12,34%". */
export function formatarPercentual(fracao: number, casas = 2): string {
  return `${(fracao * 100).toFixed(casas).replace('.', ',')}%`;
}
