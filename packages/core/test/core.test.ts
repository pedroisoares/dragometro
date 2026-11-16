import { describe, expect, it } from 'vitest';
import {
  acumular,
  compararComOficial,
  extrairEmbalagem,
  chaveCategoria,
  indicePessoal,
  indicePorCategoria,
  lerUnidadeCupom,
  mediaGeometrica,
  pesosPorGasto,
  precoPorUnidadeBase,
  semanaISO,
  variacaoDoItem,
  type ItemComprado,
  type ObservacaoPreco,
} from '../src';

describe('exemplo do leite de caixinha', () => {
  // Três compras em semanas seguidas de novembro: 5,69 → 3,79 → 4,80
  const obs: ObservacaoPreco[] = [
    { produtoId: 'leite', data: '2026-11-02', preco: 5.69 },
    { produtoId: 'leite', data: '2026-11-09', preco: 3.79 },
    { produtoId: 'leite', data: '2026-11-16', preco: 4.8 },
  ];

  it('calcula a variação semanal e a acumulada', () => {
    const serie = variacaoDoItem(obs, 'leite', 'semana');
    expect(serie.map((s) => s.periodo)).toEqual(['2026-W45', '2026-W46', '2026-W47']);
    expect(serie[0]!.variacao).toBeUndefined();
    expect(serie[1]!.variacao).toBeCloseTo(-0.3339, 4);
    expect(serie[2]!.variacao).toBeCloseTo(0.2665, 4);
    expect(serie[2]!.acumulado).toBeCloseTo(-0.1564, 4);
  });

  it('encadear as semanas dá o mesmo que comparar a última com a primeira', () => {
    const serie = variacaoDoItem(obs, 'leite', 'semana');
    const encadeado = acumular(serie.slice(1).map((s) => s.variacao!));
    expect(encadeado).toBeCloseTo(4.8 / 5.69 - 1, 10);
  });

  it('usa a média geométrica como preço do mês', () => {
    const [mes] = variacaoDoItem(obs, 'leite', 'mes');
    expect(mes!.periodo).toBe('2026-11');
    expect(mes!.preco).toBeCloseTo(4.6953, 3);
    expect(mes!.preco).toBeCloseTo(mediaGeometrica([5.69, 3.79, 4.8]), 10);
  });
});

describe('índice pessoal (Laspeyres modificado)', () => {
  const obs: ObservacaoPreco[] = [
    { produtoId: 'leite', data: '2026-01-10', preco: 5 },
    { produtoId: 'arroz', data: '2026-01-10', preco: 20 },
    { produtoId: 'leite', data: '2026-02-10', preco: 5.5 },
    { produtoId: 'arroz', data: '2026-02-10', preco: 20 },
    { produtoId: 'leite', data: '2026-03-10', preco: 5.5 },
    { produtoId: 'arroz', data: '2026-03-10', preco: 22 },
  ];
  const pesos = new Map([
    ['leite', 0.6],
    ['arroz', 0.4],
  ]);

  it('pondera as variações e atualiza os pesos a cada mês', () => {
    const serie = indicePessoal(obs, pesos, 'mes');
    expect(serie).toHaveLength(2);
    // fev: só o leite subiu 10% e pesa 60% → 6%
    expect(serie[0]!.periodo).toBe('2026-02');
    expect(serie[0]!.variacao).toBeCloseTo(0.06, 10);
    // mar: só o arroz subiu 10%, mas agora pesa 0,4/1,06 ≈ 37,7% → ≈ 3,77%
    expect(serie[1]!.variacao).toBeCloseTo(0.4 / 1.06 * 0.1, 10);
    // como tudo subiu 10% no fim, o acumulado é exatamente 10%
    expect(serie[1]!.acumulado).toBeCloseTo(0.1, 10);
  });

  it('ignora no mês o produto que não foi comprado e reescala os pesos', () => {
    const semArrozEmMarco = obs.filter((o) => !(o.produtoId === 'arroz' && o.data.startsWith('2026-03')));
    const serie = indicePessoal(semArrozEmMarco, pesos, 'mes');
    expect(serie[1]!.variacao).toBeCloseTo(0, 10); // só o leite, que ficou estável
  });

  it('compara com a série oficial', () => {
    const serie = indicePessoal(obs, pesos, 'mes');
    const ipca = new Map([
      ['2026-02', 0.005],
      ['2026-03', 0.004],
    ]);
    const comp = compararComOficial(serie, ipca);
    expect(comp[0]!.diferenca).toBeCloseTo(0.055, 10);
  });
});

describe('pesos por gasto', () => {
  it('divide o gasto de cada produto pelo total', () => {
    const base = (produtoId: string, valorTotal: number): ItemComprado => ({
      produtoId,
      descricao: produtoId,
      data: '2026-01-01',
      quantidade: 1,
      unidade: 'un',
      valorUnitario: valorTotal,
      valorTotal,
    });
    const pesos = pesosPorGasto([base('a', 30), base('b', 60), base('a', 10)]);
    expect(pesos.get('a')).toBeCloseTo(0.4);
    expect(pesos.get('b')).toBeCloseTo(0.6);
  });
});

describe('unidades', () => {
  it('lê o tamanho da embalagem na descrição', () => {
    expect(extrairEmbalagem('LEITE UHT INTEGRAL 1L')).toEqual({ quantidade: 1, unidade: 'l' });
    expect(extrairEmbalagem('CAFE TORRADO MOIDO 500G')).toEqual({ quantidade: 0.5, unidade: 'kg' });
    expect(extrairEmbalagem('REFRIG COLA 2,5L')).toEqual({ quantidade: 2.5, unidade: 'l' });
    expect(extrairEmbalagem('AGUA MINERAL 6X1,5L')).toEqual({ quantidade: 9, unidade: 'l' });
    expect(extrairEmbalagem('PAO FRANCES')).toBeUndefined();
  });

  it('entende unidades com sufixo numérico, como vêm de alguns caixas ("KG0001")', () => {
    expect(lerUnidadeCupom('KG0001')).toBe('kg');
    expect(lerUnidadeCupom('UN')).toBe('un');
    expect(lerUnidadeCupom('LT')).toBe('l');
  });

  it('calcula o preço por kg/L para comparar embalagens diferentes', () => {
    expect(precoPorUnidadeBase(4.79, 'un', 'LEITE UHT 1L')).toEqual({ preco: 4.79, unidade: 'l' });
    expect(precoPorUnidadeBase(12.5, 'un', 'CAFE 500G').preco).toBeCloseTo(25);
    expect(precoPorUnidadeBase(18.9, 'kg', 'PAO FRANCES')).toEqual({ preco: 18.9, unidade: 'kg' });
  });
});

describe('períodos', () => {
  it('calcula a semana ISO', () => {
    expect(semanaISO('2026-11-15')).toBe('2026-W46'); // domingo
    expect(semanaISO('2026-11-16')).toBe('2026-W47'); // segunda
    expect(semanaISO('2027-01-01')).toBe('2026-W53');
  });
});

describe('índice por categoria (como o IPCA: Jevons dentro, Laspeyres entre)', () => {
  // Leite comprado em duas lojas (produtos diferentes, mesma categoria) e arroz.
  const obs: ObservacaoPreco[] = [
    { produtoId: 'lojaA:leite', categoria: '1111004', data: '2026-01-10', preco: 5 },
    { produtoId: 'lojaB:leite', categoria: '1111004', data: '2026-01-12', preco: 4 },
    { produtoId: 'lojaA:arroz', categoria: '1101002', data: '2026-01-10', preco: 30 },
    { produtoId: 'lojaA:leite', categoria: '1111004', data: '2026-02-10', preco: 5.5 },
    { produtoId: 'lojaB:leite', categoria: '1111004', data: '2026-02-12', preco: 4 },
    { produtoId: 'lojaA:arroz', categoria: '1101002', data: '2026-02-10', preco: 30 },
  ];
  const pesos = new Map([
    ['1111004', 0.5],
    ['1101002', 0.5],
  ]);

  it('junta lojas diferentes na mesma categoria pela média geométrica', () => {
    const [fev] = indicePorCategoria(obs, pesos, 'mes');
    const leite = Math.sqrt(1.1 * 1); // Jevons: +10% numa loja, 0% na outra
    expect(fev!.periodo).toBe('2026-02');
    expect(fev!.variacao).toBeCloseTo(0.5 * leite + 0.5 * 1 - 1, 10);
  });

  it('produto sem categoria vira uma categoria sozinho', () => {
    expect(chaveCategoria({ produtoId: 'x' })).toBe('produto:x');
    expect(chaveCategoria({ produtoId: 'x', categoria: '1111004' })).toBe('1111004');
  });

  it('com uma categoria por produto, dá o mesmo que o índice por produto', () => {
    const porProduto = obs.map(({ categoria: _c, ...o }) => o);
    const pesosProduto = new Map([
      ['lojaA:leite', 0.25],
      ['lojaB:leite', 0.25],
      ['lojaA:arroz', 0.5],
    ]);
    const a = indicePessoal(porProduto, pesosProduto, 'mes');
    const b = indicePorCategoria(
      porProduto,
      new Map([...pesosProduto].map(([k, v]) => [`produto:${k}`, v])),
      'mes',
    );
    expect(b[0]!.variacao).toBeCloseTo(a[0]!.variacao, 10);
  });
});
