/** Converte número no formato brasileiro ("1.234,56", "R$ 5,69") para `number`. */
export function lerNumeroBR(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  if (normalizado === '' || Number.isNaN(n)) throw new Error(`Número inválido: "${texto}"`);
  return n;
}

/** Converte "15/11/2026 13:25:00" em "2026-11-15T13:25:00". */
export function lerDataHoraBR(texto: string): string | undefined {
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/.exec(texto);
  if (!m) return undefined;
  const [, d, mes, a, hora] = m;
  return hora ? `${a}-${mes}-${d}T${hora.length === 5 ? `${hora}:00` : hora}` : `${a}-${mes}-${d}`;
}
