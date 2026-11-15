/**
 * Cliente da API SIDRA do IBGE (https://apisidra.ibge.gov.br).
 *
 * Tabelas usadas (conferidas em nov/2026):
 *   IPCA  índice geral: tabela 1737, variável 63 (variação mensal, %)
 *   INPC  índice geral: tabela 1736, variável 44 (variação mensal, %)
 *   IPCA  por subitem:  tabela 7060, variáveis 63 (variação) e 66 (peso), classificação 315
 *   INPC  por subitem:  tabela 7063, variáveis 44 (variação) e 45 (peso), classificação 315
 * As tabelas de subitem começam em jan/2020 (pesos da POF 2017-2018).
 */

export type Indice = 'IPCA' | 'INPC';

const BASE = 'https://apisidra.ibge.gov.br/values';

const TABELAS = {
  IPCA: { geral: '1737', variacao: '63', subitens: '7060', variacaoSub: '63', pesoSub: '66' },
  INPC: { geral: '1736', variacao: '44', subitens: '7063', variacaoSub: '44', pesoSub: '45' },
} as const;

/** Código da categoria "Índice geral" na classificação 315. */
export const CODIGO_INDICE_GERAL = '7169';

/** Ou os últimos N meses, ou um intervalo `AAAA-MM` a `AAAA-MM`. */
export type Periodo = { ultimos: number } | { de: string; ate: string };

type LinhaSidra = Record<string, string>;

function periodoParaSidra(p: Periodo): string {
  if ('ultimos' in p) return `last%20${p.ultimos}`;
  return `${p.de.replace('-', '')}-${p.ate.replace('-', '')}`;
}

/** "202610" → "2026-10" */
function mesSidra(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4, 6)}`;
}

/** Valores ausentes no SIDRA aparecem como "...", "-", "X". */
function numeroSidra(v: string | undefined): number | undefined {
  if (v === undefined || !/^-?\d/.test(v)) return undefined;
  return Number(v);
}

async function consultar(caminho: string, fetchFn: typeof fetch): Promise<LinhaSidra[]> {
  const resposta = await fetchFn(`${BASE}${caminho}?formato=json`, {
    headers: { Accept: 'application/json' },
  });
  if (!resposta.ok) throw new Error(`SIDRA respondeu ${resposta.status}`);
  const linhas = (await resposta.json()) as LinhaSidra[];
  // A primeira linha é o cabeçalho com os nomes das colunas.
  return linhas.slice(1);
}

/**
 * Variação mensal do índice geral, como fração (0,0014 = 0,14%).
 * Retorna `Map<'AAAA-MM', variação>` em ordem cronológica.
 */
export async function variacaoMensal(
  indice: Indice,
  periodo: Periodo = { ultimos: 12 },
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, number>> {
  const t = TABELAS[indice];
  const linhas = await consultar(
    `/t/${t.geral}/n1/all/v/${t.variacao}/p/${periodoParaSidra(periodo)}`,
    fetchFn,
  );
  const pares: [string, number][] = [];
  for (const l of linhas) {
    const v = numeroSidra(l.V);
    if (l.D3C && v !== undefined) pares.push([mesSidra(l.D3C), v / 100]);
  }
  return new Map(pares.sort(([a], [b]) => a.localeCompare(b)));
}

export interface Subitem {
  /** Código da categoria no SIDRA (classificação 315), ex.: "12393". */
  codigoSidra: string;
  /** Código do IBGE no nome, ex.: "1111004". Grupos têm códigos curtos ("11"). */
  codigo: string;
  /** Nome sem o código, ex.: "Leite longa vida". */
  nome: string;
  periodo: string;
  /** Variação no mês, como fração. */
  variacao?: number;
  /** Peso no índice, como fração (0,00796 = 0,796%). */
  peso?: number;
}

/**
 * Variação e peso de cada grupo, subgrupo, item e subitem do índice.
 * Use para comparar "o meu leite" com o subitem "Leite longa vida".
 */
export async function subitens(
  indice: Indice,
  periodo: Periodo = { ultimos: 1 },
  fetchFn: typeof fetch = fetch,
): Promise<Subitem[]> {
  const t = TABELAS[indice];
  const linhas = await consultar(
    `/t/${t.subitens}/n1/all/v/${t.variacaoSub},${t.pesoSub}/p/${periodoParaSidra(periodo)}/c315/all`,
    fetchFn,
  );

  const porChave = new Map<string, Subitem>();
  for (const l of linhas) {
    if (!l.D3C || !l.D4C || !l.D4N) continue;
    const periodoMes = mesSidra(l.D3C);
    const chave = `${periodoMes}|${l.D4C}`;
    const [, codigo = '', nome = l.D4N] = /^(\d+)\.(.*)$/.exec(l.D4N) ?? [];
    const item = porChave.get(chave) ?? {
      codigoSidra: l.D4C,
      codigo,
      nome: nome.trim(),
      periodo: periodoMes,
    };
    const v = numeroSidra(l.V);
    if (v !== undefined) {
      if (l.D2C === t.variacaoSub) item.variacao = v / 100;
      if (l.D2C === t.pesoSub) item.peso = v / 100;
    }
    porChave.set(chave, item);
  }
  return [...porChave.values()];
}
