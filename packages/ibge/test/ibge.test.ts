import { describe, expect, it } from 'vitest';
import { subitens, variacaoMensal, variacaoMensalCategoria } from '../src';

// Respostas no formato real do SIDRA (valores de set e out/2026, consultados em 15/11/2026).
const CABECALHO_GERAL = {
  NC: 'Nível Territorial (Código)', NN: 'Nível Territorial', MC: 'Unidade de Medida (Código)',
  MN: 'Unidade de Medida', V: 'Valor', D1C: 'Brasil (Código)', D1N: 'Brasil',
  D2C: 'Variável (Código)', D2N: 'Variável', D3C: 'Mês (Código)', D3N: 'Mês',
};

const ipcaGeral = [
  CABECALHO_GERAL,
  { NC: '1', NN: 'Brasil', MC: '2', MN: '%', V: '0.82', D1C: '1', D1N: 'Brasil', D2C: '63', D2N: 'IPCA - Variação mensal', D3C: '202609', D3N: 'setembro 2026' },
  { NC: '1', NN: 'Brasil', MC: '2', MN: '%', V: '0.14', D1C: '1', D1N: 'Brasil', D2C: '63', D2N: 'IPCA - Variação mensal', D3C: '202610', D3N: 'outubro 2026' },
];

const ipcaSubitens = [
  { ...CABECALHO_GERAL, D4C: 'Geral, grupo, subgrupo, item e subitem (Código)', D4N: 'Geral, grupo, subgrupo, item e subitem' },
  { V: '0.14', D2C: '63', D3C: '202610', D4C: '7169', D4N: 'Índice geral' },
  { V: '-0.67', D2C: '63', D3C: '202610', D4C: '12393', D4N: '1111004.Leite longa vida' },
  { V: '100.0000', D2C: '66', D3C: '202610', D4C: '7169', D4N: 'Índice geral' },
  { V: '0.7960', D2C: '66', D3C: '202610', D4C: '12393', D4N: '1111004.Leite longa vida' },
  { V: '...', D2C: '63', D3C: '202610', D4C: '99999', D4N: '9999999.Sem dado' },
];

function fetchFalso(corpo: unknown, urls: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify(corpo), { status: 200 });
  }) as typeof fetch;
}

describe('variacaoMensal', () => {
  it('monta a URL certa e converte para fração', async () => {
    const urls: string[] = [];
    const serie = await variacaoMensal('IPCA', { ultimos: 2 }, fetchFalso(ipcaGeral, urls));
    expect(urls[0]).toBe('https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/63/p/last%202?formato=json');
    expect([...serie.keys()]).toEqual(['2026-09', '2026-10']);
    expect(serie.get('2026-10')).toBeCloseTo(0.0014, 10);
  });

  it('usa a tabela do INPC e aceita intervalo de meses', async () => {
    const urls: string[] = [];
    await variacaoMensal('INPC', { de: '2026-01', ate: '2026-10' }, fetchFalso([CABECALHO_GERAL], urls));
    expect(urls[0]).toContain('/t/1736/n1/all/v/44/p/202601-202610');
  });
});

describe('subitens', () => {
  it('junta variação e peso de cada subitem', async () => {
    const lista = await subitens('IPCA', { ultimos: 1 }, fetchFalso(ipcaSubitens));
    const leite = lista.find((s) => s.codigo === '1111004')!;
    expect(leite.nome).toBe('Leite longa vida');
    expect(leite.periodo).toBe('2026-10');
    expect(leite.variacao).toBeCloseTo(-0.0067, 10);
    expect(leite.peso).toBeCloseTo(0.00796, 10);

    const geral = lista.find((s) => s.codigoSidra === '7169')!;
    expect(geral.nome).toBe('Índice geral');
    expect(geral.peso).toBeCloseTo(1, 10);

    expect(lista.find((s) => s.codigoSidra === '99999')!.variacao).toBeUndefined();
  });
});

describe('variacaoMensalCategoria', () => {
  it('busca um subitem pelo código SIDRA', async () => {
    const urls: string[] = [];
    const corpo = [
      ipcaSubitens[0],
      { V: '-0.67', D2C: '63', D3C: '202610', D4C: '12393', D4N: '1111004.Leite longa vida' },
    ];
    const serie = await variacaoMensalCategoria('IPCA', '12393', { ultimos: 1 }, fetchFalso(corpo, urls));
    expect(urls[0]).toContain('/t/7060/n1/all/v/63/p/last%201/c315/12393');
    expect(serie.get('2026-10')).toBeCloseTo(-0.0067, 10);
  });
});
