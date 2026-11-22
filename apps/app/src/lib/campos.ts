/** Texto digitado num campo numérico → número. Aceita vírgula ou ponto ("16,98", "16.98"). */
export function numeroTexto(t: string): number {
  const limpo = t.trim().replace(/\s/g, '').replace(',', '.');
  return limpo && /^\d*\.?\d+$/.test(limpo) ? Number(limpo) : Number.NaN;
}

/** Valor em reais para um campo editável: 16.98 → "16,98". */
export function dinheiroTexto(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

/** Quantidade para um campo editável: inteira em unidades ("2"), 3 casas no resto ("0,345"). */
export function quantidadeTexto(v: number, unidade: string): string {
  return (unidade.toUpperCase() === 'UN' && Number.isInteger(v) ? String(v) : v.toFixed(3)).replace('.', ',');
}
