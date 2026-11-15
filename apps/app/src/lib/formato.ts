/** 54.9 → "R$ 54,90" */
export function reais(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

/** 0.204 → "0,204" */
export function numero(valor: number): string {
  return String(valor).replace('.', ',');
}

/** "2026-11-14T09:15:59" → "14/11/2026" */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const NOMES_UNIDADE = { kg: '/kg', l: '/L', un: '' } as const;

export function porUnidade(unidade: keyof typeof NOMES_UNIDADE): string {
  return NOMES_UNIDADE[unidade];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-W45" → "sem 45/26"; "2026-11" → "nov/26"; "2026" → "2026" */
export function nomePeriodo(periodo: string): string {
  const semana = /^(\d{4})-W(\d{2})$/.exec(periodo);
  if (semana) return `sem ${semana[2]}/${semana[1]!.slice(2)}`;
  const mes = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (mes) return `${MESES[Number(mes[2]) - 1]}/${mes[1]!.slice(2)}`;
  return periodo;
}
