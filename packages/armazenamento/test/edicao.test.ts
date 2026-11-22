import { readFileSync } from 'node:fs';
import { observacoesDeItens, variacaoDoItem } from '@dragometro/core';
import { lerNotaDaPagina } from '@dragometro/sefaz';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  detalheNota,
  editarDescricao,
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
