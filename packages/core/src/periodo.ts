import type { DataISO, Granularidade } from './tipos';

function lerData(data: DataISO): Date {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) throw new Error(`Data inválida: ${data}`);
  return new Date(Date.UTC(a, m - 1, d));
}

/** Semana ISO 8601 no formato `AAAA-Www` (semana começa na segunda-feira). */
export function semanaISO(data: DataISO): string {
  const d = lerData(data);
  const diaSemana = d.getUTCDay() || 7; // domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana); // quinta-feira da mesma semana
  const inicioAno = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - inicioAno) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/** Chave do período ao qual a data pertence: `2026-W46`, `2026-11` ou `2026`. */
export function chavePeriodo(data: DataISO, granularidade: Granularidade): string {
  switch (granularidade) {
    case 'semana':
      return semanaISO(data);
    case 'mes':
      return data.slice(0, 7);
    case 'ano':
      return data.slice(0, 4);
  }
}
