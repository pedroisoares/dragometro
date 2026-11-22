import { readFileSync } from 'node:fs';
import { observacoesDeItens, variacaoDoItem } from '@dragometro/core';
import { lerNotaDaPagina, type NotaFiscal } from '@dragometro/sefaz';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ESQUEMA_V1,
  excluirNota,
  gastosPorCategoria,
  idProduto,
  itensComprados,
  listarNotas,
  listarProdutos,
  migrar,
  salvarCupomFoto,
  salvarNota,
  type CupomParaSalvar,
  type BancoSQL,
} from '../src';
import { bancoEmMemoria } from './banco-node';

const fixture = (nome: string) =>
  readFileSync(new URL(`../../sefaz/test/fixtures/${nome}`, import.meta.url), 'utf8');

const supermercado = lerNotaDaPagina(fixture('sp-1.html'), '35261143259548002298652260000291801000000007');
const acougue = lerNotaDaPagina(fixture('sp-2.html'), '35261150234608000159651040000283221000000004');

let db: BancoSQL;
beforeEach(async () => {
  db = bancoEmMemoria();
  await migrar(db);
});

describe('migrações', () => {
  it('cria o esquema e pode rodar de novo sem erro', async () => {
    await migrar(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(v?.user_version).toBe(3);
  });

  it('atualiza um banco da versão 1 classificando os itens já guardados', async () => {
    const antigo = bancoEmMemoria();
    await antigo.execAsync(ESQUEMA_V1 + 'PRAGMA user_version = 1;');
    await antigo.runAsync(`INSERT INTO notas VALUES ('k', 'SP', '1', 'Loja', '2026-11-01', 10, '2026-11-01')`, []);
    await antigo.runAsync(
      `INSERT INTO itens (chave_nota, ordem, produto_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_total)
       VALUES ('k', 1, '1:97', '97', 'PATINHO KG', 1, 'KG', 10, 10)`,
      [],
    );
    await migrar(antigo);
    const [item] = await itensComprados(antigo);
    expect(item!.categoria).toBe('1107089');
  });
});

describe('notas', () => {
  it('salva as notas reais de SP e lista da mais recente para a mais antiga', async () => {
    expect(await salvarNota(db, acougue, '2026-11-15T10:00:00Z')).toBe('nova');
    expect(await salvarNota(db, supermercado, '2026-11-15T10:00:00Z')).toBe('nova');

    const notas = await listarNotas(db);
    expect(notas.map((n) => [n.nomeEmitente, n.dataEmissao, n.valorTotal, n.quantidadeItens])).toEqual([
      ['Supermercados Cavicchiolli Ltda', '2026-11-14T09:15:59', 552.92, 24],
      ['COMERCIAL PADRE BENTO SECOS E MOLHADOS L', '2026-11-07T12:57:00', 391.13, 11],
    ]);
  });

  it('não duplica a mesma nota lida duas vezes', async () => {
    await salvarNota(db, supermercado);
    expect(await salvarNota(db, supermercado)).toBe('repetida');
    expect(await itensComprados(db)).toHaveLength(24);
  });

  it('exclui a nota junto com os itens', async () => {
    await salvarNota(db, supermercado);
    await excluirNota(db, supermercado.chave);
    expect(await listarNotas(db)).toEqual([]);
    expect(await itensComprados(db)).toEqual([]);
  });

  it('desfaz tudo se um item falhar no meio', async () => {
    const quebrada = {
      ...supermercado,
      itens: [...supermercado.itens, { descricao: null }],
    } as unknown as NotaFiscal;
    await expect(salvarNota(db, quebrada)).rejects.toThrow();
    expect(await listarNotas(db)).toEqual([]);
  });
});

describe('produtos', () => {
  it('agrupa pesagens do mesmo produto e converte KG0001 em kg', async () => {
    await salvarNota(db, acougue);
    const produtos = await listarProdutos(db);
    expect(produtos).toHaveLength(3); // patinho, filé de frango, alcatra

    const frango = produtos.find((p) => p.descricao === 'FILE FRANGO KG')!;
    expect(frango.produtoId).toBe('50234608000159:122');
    expect(frango.compras).toBe(1);
    expect(frango.linhas).toBe(7);
    expect(frango.gastoTotal).toBe(151.29);

    const itens = await itensComprados(db, frango.produtoId);
    expect(itens).toHaveLength(7);
    expect(itens.every((i) => i.unidade === 'kg' && i.data === '2026-11-07')).toBe(true);
  });

  it('alimenta o cálculo de variação de preço do pacote core', async () => {
    await salvarNota(db, acougue);
    // Uma segunda compra de patinho, mais cara, na semana seguinte.
    const outra: NotaFiscal = {
      ...acougue,
      chave: '35261150234608000159651040000283221000000012',
      dataEmissao: '2026-11-14T12:00:00',
      itens: [{ codigo: '97', descricao: 'PATINHO KG', quantidade: 1, unidade: 'KG0001', valorUnitario: 59.9, valorTotal: 59.9 }],
    };
    await salvarNota(db, outra);

    const patinho = idProduto('50234608000159', { codigo: '97', descricao: 'PATINHO KG' });
    const serie = variacaoDoItem(observacoesDeItens(await itensComprados(db, patinho)), patinho, 'semana');
    expect(serie).toHaveLength(2);
    // 1ª semana: média geométrica das duas pesagens (54,903148 e 54,906103)
    expect(serie[0]!.preco).toBeCloseTo(54.9046, 3);
    expect(serie[1]!.variacao).toBeCloseTo(59.9 / 54.9046 - 1, 4);
  });
});

describe('categorias do IPCA', () => {
  it('classifica ao salvar e soma os gastos por subitem', async () => {
    await salvarNota(db, supermercado);
    await salvarNota(db, acougue);

    const produtos = await listarProdutos(db);
    expect(produtos.find((p) => p.descricao === 'PATINHO KG')!.subitem).toBe('1107089');
    expect(produtos.find((p) => p.descricao.startsWith('BAT PALHA'))!.subitem).toBeNull();

    const gastos = await gastosPorCategoria(db);
    const frango = gastos.find((g) => g.subitem === '1110010')!;
    expect(frango.gasto).toBe(151.29);
    expect(frango.itens).toBe(7);
    // 552,92 + 391,13 no total, com ou sem categoria
    expect(Math.round(gastos.reduce((s, g) => s + g.gasto, 0) * 100) / 100).toBe(944.05);
    // Sem categoria: batata palha e creme de leite
    expect(gastos.find((g) => g.subitem === null)!.itens).toBe(2);
  });
});

describe('cupons lidos pela foto', () => {
  const semana1: CupomParaSalvar = {
    loja: { nome: 'VERDURAO EXEMPLO' },
    numero: '0004521',
    dataEmissao: '2026-11-07T10:09:58',
    valorTotal: 17.81,
    itens: [
      { descricao: 'TOMATE MEDIO', quantidade: 0.685, unidade: 'KG', valorUnitario: 18.9, valorTotal: 12.95 },
      { descricao: 'ACELGA UND', quantidade: 1, unidade: 'UN', valorUnitario: 4.86, valorTotal: 4.86 },
    ],
  };
  // Na semana seguinte o OCR leu o nome da loja e a acelga um pouco diferente.
  const semana2: CupomParaSalvar = {
    loja: { nome: 'VERDURÃO EXEMPL0' },
    numero: '0004987',
    dataEmissao: '2026-11-14T09:30:00',
    valorTotal: 19.54,
    itens: [
      { descricao: 'TOMATE MEDIO', quantidade: 0.7, unidade: 'KG', valorUnitario: 19.9, valorTotal: 13.93 },
      { descricao: 'ACEL GA UND', quantidade: 1, unidade: 'UN', valorUnitario: 5.61, valorTotal: 5.61 },
    ],
  };

  it('salva sem chave nem CNPJ, sem repetir o mesmo cupom', async () => {
    expect(await salvarCupomFoto(db, semana1)).toBe('nova');
    expect(await salvarCupomFoto(db, semana1)).toBe('repetida');
    const [nota] = await listarNotas(db);
    expect(nota).toMatchObject({ nomeEmitente: 'VERDURAO EXEMPLO', origem: 'foto', quantidadeItens: 2, valorTotal: 17.81 });
    expect(nota!.chave).toMatch(/^foto:loja:VERDURAOEXEMPLO\|/);
  });

  it('junta a mesma loja e os mesmos produtos entre semanas, mesmo com o OCR diferente', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2);
    const produtos = await listarProdutos(db);
    expect(produtos).toHaveLength(2);
    expect(produtos.every((p) => p.compras === 2 && p.nomeEmitente === 'VERDURAO EXEMPLO')).toBe(true);

    const tomate = produtos.find((p) => p.descricao === 'TOMATE MEDIO')!;
    expect(tomate.subitem).toBe('1103028'); // Tomate
    const obs = observacoesDeItens(await itensComprados(db, tomate.produtoId));
    expect(obs.map((o) => o.preco)).toEqual([18.9, 19.9]);
  });

  it('notas da SEFAZ continuam com origem sefaz', async () => {
    await salvarNota(db, acougue);
    const [nota] = await listarNotas(db);
    expect(nota!.origem).toBe('sefaz');
  });
});
