import { readFileSync } from 'node:fs';
import { observacoesDeItens, variacaoDoItem } from '@dragometro/core';
import { lerNotaDaPagina } from '@dragometro/sefaz';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  detalheNota,
  editarDescricao,
  editarItem,
  itensComprados,
  juntarLojas,
  listarNotas,
  listarProdutos,
  lojasParecidas,
  migrar,
  renomearLoja,
  salvarCupomFoto,
  salvarNota,
  type BancoSQL,
  type CupomParaSalvar,
} from '../src';
import { bancoEmMemoria } from './banco-node';

let db: BancoSQL;
beforeEach(async () => {
  db = bancoEmMemoria();
  await migrar(db);
});

const cupom = (loja: string, data: string, itens: [string, number, number][]): CupomParaSalvar => ({
  loja: { nome: loja },
  dataEmissao: data,
  itens: itens.map(([descricao, quantidade, valorUnitario]) => ({
    descricao,
    quantidade,
    unidade: 'KG',
    valorUnitario,
    valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
  })),
});

const semana1 = cupom('VERDURAO EXEMPLO', '2026-11-07T10:00:00', [
  ['TOMATE ITALIANO', 1, 10],
  ['CEBOLA', 1, 5],
]);
// Na semana 2 o OCR leu mal o tomate: vira outro produto, sem categoria.
const semana2 = cupom('VERDURAO EXEMPLO', '2026-11-14T10:00:00', [
  ['T0MAT3 1TAL1AN0', 1, 11],
  ['CEBOLA', 1, 5.5],
]);

async function produto(descricaoInicio: string) {
  return (await listarProdutos(db)).filter((p) => p.descricao.startsWith(descricaoInicio));
}

async function chaveDe(data: string) {
  return (await listarNotas(db)).find((n) => n.dataEmissao === data)!.chave;
}

describe('corrigir a descrição de um item', () => {
  it('junta o item ao produto certo, reclassifica e entra nas contas de variação', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2);
    expect(await produto('T')).toHaveLength(2); // tomate dividido em dois produtos

    const r = await editarDescricao(db, await chaveDe('2026-11-14T10:00:00'), 1, ' tomate  italiano ');
    expect(r).toMatchObject({ comprasDoProduto: 2, itensAlterados: 1, subitem: '1103028' });

    const [tomate] = await produto('T');
    expect(tomate).toMatchObject({ descricao: 'TOMATE ITALIANO', compras: 2, subitem: '1103028' });
    expect(await produto('T')).toHaveLength(1);

    // A variação de preço agora compara as duas semanas: 10 → 11 = +10%.
    const serie = variacaoDoItem(observacoesDeItens(await itensComprados(db, r.produtoId)), r.produtoId, 'semana');
    expect(serie.map((s) => Math.round(s.preco * 100) / 100)).toEqual([10, 11]);
    expect(serie[1]!.variacao).toBeCloseTo(0.1);
  });

  it('separa o item quando a correção diz que era outro produto', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, { ...semana2, itens: [semana2.itens[1]!] }); // só cebola
    expect((await produto('CEBOLA'))[0]!.compras).toBe(2);

    const r = await editarDescricao(db, await chaveDe('2026-11-14T10:00:00'), 1, 'CEBOLA ROXA');
    // "CEBOLAROXA" e "CEBOLA" têm só 6 de 10 letras em comum: vira outro produto.
    expect(r.comprasDoProduto).toBe(1);
    expect((await produto('CEBOLA')).map((p) => [p.descricao, p.compras]).sort()).toEqual([
      ['CEBOLA ROXA', 1],
      ['CEBOLA', 1],
    ]);
  });

  it('pode corrigir todas as compras do mesmo produto de uma vez', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2);
    const r = await editarDescricao(db, await chaveDe('2026-11-14T10:00:00'), 2, 'CEBOLA BRANCA', { todasDoProduto: true });
    expect(r).toMatchObject({ itensAlterados: 2, comprasDoProduto: 2 });
    expect((await produto('CEBOLA')).map((p) => p.descricao)).toEqual(['CEBOLA BRANCA']);
  });

  it('em cupom da SEFAZ, o código manda: corrige todas as compras do produto e o produto não muda', async () => {
    const acougue = lerNotaDaPagina(
      readFileSync(new URL('../../sefaz/test/fixtures/sp-2.html', import.meta.url), 'utf8'),
      '35261150234608000159651040000283221000000004',
    );
    await salvarNota(db, acougue);
    const antes = (await detalheNota(db, acougue.chave))!.itens[0]!;
    expect(antes).toMatchObject({ descricao: 'PATINHO KG', temCodigo: true, comprasDoProduto: 2 });

    const r = await editarDescricao(db, acougue.chave, 1, 'Carne patinho kg');
    expect(r).toMatchObject({ produtoId: antes.produtoId, itensAlterados: 2, comprasDoProduto: 2 });
    const depois = (await detalheNota(db, acougue.chave))!.itens.slice(0, 2).map((i) => i.descricao);
    expect(depois).toEqual(['CARNE PATINHO KG', 'CARNE PATINHO KG']);
  });

  it('recusa descrição vazia', async () => {
    await salvarCupomFoto(db, semana1);
    await expect(editarDescricao(db, await chaveDe('2026-11-07T10:00:00'), 1, '   ')).rejects.toThrow(/vazia/);
  });
});

describe('lojas guardadas duas vezes', () => {
  // O OCR leu o nome tão diferente na semana 2 que virou outra loja.
  const semana2OutraLoja = { ...semana2, loja: { nome: 'VERDUR4O EXFMPLD' } };

  it('renomear não muda as contas; juntar as lojas junta os produtos', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, { ...semana2OutraLoja, itens: [semana2.itens[1]!] });
    expect((await produto('CEBOLA')).map((p) => p.compras)).toEqual([1, 1]); // separados

    const lojaB = (await detalheNota(db, await chaveDe('2026-11-14T10:00:00')))!.lojaId;
    await renomearLoja(db, lojaB, 'Verdurão Exemplo');
    expect((await produto('CEBOLA')).map((p) => p.compras)).toEqual([1, 1]); // só o nome mudou

    const parecidas = await lojasParecidas(db, lojaB, 'Verdurão Exemplo');
    expect(parecidas).toEqual([{ id: 'loja:VERDURAOEXEMPLO', nome: 'VERDURAO EXEMPLO', compras: 1 }]);

    const fica = await juntarLojas(db, lojaB, parecidas[0]!.id, 'Verdurão Exemplo');
    expect(fica).toBe(lojaB);
    const [cebola] = await produto('CEBOLA');
    expect(cebola).toMatchObject({ compras: 2, nomeEmitente: 'Verdurão Exemplo' });
    const serie = variacaoDoItem(observacoesDeItens(await itensComprados(db, cebola!.produtoId)), cebola!.produtoId, 'semana');
    expect(serie.map((s) => Math.round(s.preco * 100) / 100)).toEqual([5, 5.5]);

    const notas = await listarNotas(db);
    expect(new Set(notas.map((n) => n.nomeEmitente))).toEqual(new Set(['Verdurão Exemplo']));
    expect(notas.every((n) => n.chave.startsWith(`foto:${lojaB}|`))).toBe(true);
  });

  it('depois de juntar, fotografar de novo o mesmo cupom não duplica', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2OutraLoja);
    const lojaB = (await detalheNota(db, await chaveDe('2026-11-14T10:00:00')))!.lojaId;
    await juntarLojas(db, 'loja:VERDURAOEXEMPLO', lojaB, 'VERDURAO EXEMPLO');
    expect(await salvarCupomFoto(db, semana2)).toBe('repetida');
    expect(await salvarCupomFoto(db, semana1)).toBe('repetida');
    expect(await listarNotas(db)).toHaveLength(2);
  });

  it('loja com CNPJ fica; duas lojas com CNPJ nunca se juntam', async () => {
    await salvarCupomFoto(db, { ...semana1, loja: { nome: 'PADARIA EXEMPLO', cnpj: '11222333000181' } });
    await salvarCupomFoto(db, { ...semana2, loja: { nome: 'PADARIA EXEMPLO' } });
    const fica = await juntarLojas(db, 'loja:PADARIAEXEMPLO', '11222333000181', 'PADARIA EXEMPLO');
    expect(fica).toBe('11222333000181');
    expect(await lojasParecidas(db, '11222333000181', 'PADARIA EXEMPLO')).toEqual([]);
    await expect(juntarLojas(db, '11222333000181', '99888777000166', 'X')).rejects.toThrow(/CNPJ/);
  });
});

describe('corrigir quantidade, unidade e valores de um item', () => {
  it('corrige só este item, e a variação de preço usa os valores novos', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2);
    const chave2 = await chaveDe('2026-11-14T10:00:00');
    // Cebola da semana 2 foi lida como 1 kg × 5,50; o certo era 0,800 kg × 6,00 = 4,80.
    const r = await editarItem(db, chave2, 2, { quantidade: 0.8, unidade: 'kg', valorUnitario: 6, valorTotal: 4.8 });
    expect(r).toMatchObject({ contaFecha: true, itensAlterados: 1, comprasDoProduto: 2 });

    const item = (await detalheNota(db, chave2))!.itens[1]!;
    expect(item).toMatchObject({ quantidade: 0.8, unidade: 'KG', valorUnitario: 6, valorTotal: 4.8, descricao: 'CEBOLA' });
    const [cebola] = await produto('CEBOLA');
    const serie = variacaoDoItem(observacoesDeItens(await itensComprados(db, cebola!.produtoId)), cebola!.produtoId, 'semana');
    expect(serie.map((s) => Math.round(s.preco * 100) / 100)).toEqual([5, 6]);
    // A outra semana não mudou.
    expect((await detalheNota(db, await chaveDe('2026-11-07T10:00:00')))!.itens[1]).toMatchObject({ valorUnitario: 5 });
  });

  it('corrige descrição e valores de uma vez', async () => {
    await salvarCupomFoto(db, semana1);
    await salvarCupomFoto(db, semana2);
    const r = await editarItem(db, await chaveDe('2026-11-14T10:00:00'), 1, {
      descricao: 'TOMATE ITALIANO',
      quantidade: 1.1,
      valorUnitario: 10,
      valorTotal: 11,
    });
    expect(r).toMatchObject({ comprasDoProduto: 2, subitem: '1103028', contaFecha: true });
  });

  it('salva mesmo quando a conta não fecha (desconto), mas avisa', async () => {
    await salvarCupomFoto(db, semana1);
    const r = await editarItem(db, await chaveDe('2026-11-07T10:00:00'), 2, { valorTotal: 4.5 });
    expect(r.contaFecha).toBe(false);
  });

  it('recusa valores inválidos', async () => {
    await salvarCupomFoto(db, semana1);
    const chave = await chaveDe('2026-11-07T10:00:00');
    await expect(editarItem(db, chave, 1, { quantidade: 0 })).rejects.toThrow(/quantidade/);
    await expect(editarItem(db, chave, 1, { valorUnitario: Number.NaN })).rejects.toThrow(/valor unitário/);
    await expect(editarItem(db, chave, 1, { unidade: ' ' })).rejects.toThrow(/unidade/);
    await expect(editarItem(db, chave, 99, { valorTotal: 1 })).rejects.toThrow(/não encontrado/);
  });
});

describe('migração v4', () => {
  it('itens da foto com quantidade fracionada e unidade UN passam a KG', async () => {
    await salvarCupomFoto(db, {
      ...semana1,
      itens: [
        { descricao: 'LARANJA PERA', quantidade: 0.965, unidade: 'UN', valorUnitario: 4.99, valorTotal: 4.82 },
        { descricao: 'ALFACE', quantidade: 2, unidade: 'UN', valorUnitario: 3, valorTotal: 6 },
      ],
    });
    await db.execAsync('PRAGMA user_version = 3');
    await migrar(db);
    const itens = (await detalheNota(db, await chaveDe('2026-11-07T10:00:00')))!.itens;
    expect(itens.map((i) => i.unidade)).toEqual(['KG', 'UN']);
  });
});
