import { classificar } from '@dragometro/classificacao';
import { chaveDeComparacao, contaFecha, maisParecido, semelhanca } from '@dragometro/foto';
import type { BancoSQL } from './banco';

/**
 * Correções feitas pela pessoa depois de salvar: descrição de um item e lojas repetidas.
 *
 * Os cálculos (variação de preço, média geométrica dentro do subitem, índice pessoal)
 * usam dois dados de cada item: o PRODUTO (`produto_id`, que diz quais compras são "o
 * mesmo produto") e o SUBITEM do IPCA. Por isso, toda correção aqui termina recalculando
 * esses dois campos. O nome da loja é só exibição e não entra nas contas.
 */

/** Descrição como guardada: maiúsculas e espaços simples. */
function normalizarDescricao(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, ' ');
}

export interface ResultadoEdicao {
  /** Produto ao qual o item pertence depois da correção. */
  produtoId: string;
  /** Quantas compras (itens) desse produto existem agora, contando este. */
  comprasDoProduto: number;
  /** Quantos itens tiveram a descrição alterada. */
  itensAlterados: number;
  /** Subitem do IPCA depois da correção (null = sem categoria). */
  subitem: string | null;
}

/**
 * Corrige a descrição de um item de um cupom.
 *
 * - Item com código (cupom da SEFAZ): o código identifica o produto, então a descrição é
 *   corrigida em todas as compras desse produto.
 * - Item lido pela foto (sem código): corrige este item, ou todas as compras do mesmo
 *   produto se `todasDoProduto`. Depois, os produtos da loja são reagrupados: se a nova
 *   descrição for igual ou parecida com a de outro produto já comprado ali, o item passa a
 *   ser esse produto (e entra nas mesmas contas de variação de preço).
 *
 * Em todos os casos, o subitem do IPCA é recalculado pela nova descrição.
 */
export async function editarDescricao(
  db: BancoSQL,
  chaveNota: string,
  ordem: number,
  novaDescricao: string,
  opcoes: { todasDoProduto?: boolean } = {},
): Promise<ResultadoEdicao> {
  return editarItem(db, chaveNota, ordem, { descricao: novaDescricao }, opcoes);
}

/** Unidades oferecidas na edição de um item (como o cupom escreve). */
export const UNIDADES_ITEM = ['UN', 'KG', 'G', 'L', 'ML'] as const;

/** O que pode ser corrigido num item. Campos ausentes ficam como estão. */
export interface EdicaoItem {
  descricao?: string;
  quantidade?: number;
  /** Como no cupom: "UN", "KG", "G", "L", "ML" (ou a unidade original, como "PCT"). */
  unidade?: string;
  valorUnitario?: number;
  valorTotal?: number;
}

export interface ResultadoEdicaoItem extends ResultadoEdicao {
  /** Quantidade × valor unitário = valor total (com arredondamento ou truncamento)? */
  contaFecha: boolean;
}

/**
 * Corrige um item de um cupom: descrição, quantidade, unidade, valor unitário e total.
 *
 * - Quantidade, unidade e valor unitário formam o preço comparável (R$/kg, R$/L, R$/un)
 *   usado na variação de preço e na média geométrica; o valor total é o gasto, que pesa
 *   a categoria no índice pessoal. Essas correções valem só para ESTE item.
 * - A descrição segue as regras de `editarDescricao` (reclassifica no IPCA e reagrupa).
 *
 * A conta pode não fechar (desconto no item, por exemplo): a correção é salva assim
 * mesmo, e `contaFecha` avisa.
 */
export async function editarItem(
  db: BancoSQL,
  chaveNota: string,
  ordem: number,
  edicao: EdicaoItem,
  { todasDoProduto = false }: { todasDoProduto?: boolean } = {},
): Promise<ResultadoEdicaoItem> {
  const item = await db.getFirstAsync<{
    id: number;
    produtoId: string;
    codigo: string | null;
    lojaId: string;
    descricao: string;
    subitem: string | null;
    quantidade: number;
    unidade: string;
    valorUnitario: number;
    valorTotal: number;
  }>(
    `SELECT i.id, i.produto_id AS produtoId, i.codigo, n.cnpj_emitente AS lojaId, i.descricao, i.subitem,
            i.quantidade, i.unidade, i.valor_unitario AS valorUnitario, i.valor_total AS valorTotal
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      WHERE i.chave_nota = ? AND i.ordem = ?`,
    [chaveNota, ordem],
  );
  if (!item) throw new Error('Item não encontrado.');

  const descricao = edicao.descricao === undefined ? item.descricao : normalizarDescricao(edicao.descricao);
  if (!descricao) throw new Error('A descrição não pode ficar vazia.');
  const quantidade = edicao.quantidade ?? item.quantidade;
  const valorUnitario = edicao.valorUnitario ?? item.valorUnitario;
  const valorTotal = edicao.valorTotal ?? item.valorTotal;
  const unidade = (edicao.unidade ?? item.unidade).trim().toUpperCase();
  for (const [nome, v] of [
    ['A quantidade', quantidade],
    ['O valor unitário', valorUnitario],
    ['O valor total', valorTotal],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${nome} precisa ser um número maior que zero.`);
  }
  if (!unidade) throw new Error('Escolha a unidade.');

  const mudouDescricao = descricao !== item.descricao;
  const subitem = mudouDescricao ? (classificar(descricao)?.codigo ?? null) : item.subitem;
  let itensAlterados = 1;

  await db.withTransactionAsync(async () => {
    if (mudouDescricao) {
      const r =
        item.codigo || todasDoProduto
          ? await db.runAsync('UPDATE itens SET descricao = ?, subitem = ? WHERE produto_id = ?', [descricao, subitem, item.produtoId])
          : await db.runAsync('UPDATE itens SET descricao = ?, subitem = ? WHERE id = ?', [descricao, subitem, item.id]);
      itensAlterados = r.changes;
    }
    await db.runAsync(
      'UPDATE itens SET quantidade = ?, unidade = ?, valor_unitario = ?, valor_total = ? WHERE id = ?',
      [quantidade, unidade, valorUnitario, valorTotal, item.id],
    );
    if (mudouDescricao && !item.codigo) await reagruparLoja(db, item.lojaId);
  });

  const depois = await db.getFirstAsync<{ produtoId: string; compras: number }>(
    `SELECT i.produto_id AS produtoId, (SELECT COUNT(*) FROM itens j WHERE j.produto_id = i.produto_id) AS compras
       FROM itens i WHERE i.id = ?`,
    [item.id],
  );
  return {
    produtoId: depois!.produtoId,
    comprasDoProduto: depois!.compras,
    itensAlterados,
    subitem,
    contaFecha: contaFecha(quantidade, valorUnitario, valorTotal),
  };
}

/**
 * Refaz o agrupamento em produtos dos itens lidos pela foto (sem código) de uma loja.
 *
 * Percorre os itens do mais antigo para o mais recente. Cada um vira o mesmo produto de
 * um item anterior com descrição igual ou parecida (o OCR muda espaços e letras de uma foto
 * para outra), ou de um produto com código da mesma loja; senão, um produto novo.
 * Devolve quantos itens mudaram de produto.
 */
export async function reagruparLoja(db: BancoSQL, lojaId: string): Promise<number> {
  const comCodigo = await db.getAllAsync<{ produtoId: string; descricao: string }>(
    `SELECT i.produto_id AS produtoId, MAX(i.descricao) AS descricao
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      WHERE n.cnpj_emitente = ? AND i.codigo IS NOT NULL
      GROUP BY i.produto_id`,
    [lojaId],
  );
  const semCodigo = await db.getAllAsync<{ id: number; produtoId: string; descricao: string }>(
    `SELECT i.id, i.produto_id AS produtoId, i.descricao
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      WHERE n.cnpj_emitente = ? AND i.codigo IS NULL
      ORDER BY n.data_emissao, n.chave, i.ordem`,
    [lojaId],
  );
  const conhecidos = [...comCodigo];
  let mudaram = 0;
  for (const item of semCodigo) {
    const mesmo = maisParecido(item.descricao, conhecidos, (p) => p.descricao);
    const produtoId = mesmo?.produtoId ?? `${lojaId}:${chaveDeComparacao(item.descricao)}`;
    if (!mesmo) conhecidos.push({ produtoId, descricao: item.descricao });
    if (produtoId !== item.produtoId) {
      await db.runAsync('UPDATE itens SET produto_id = ? WHERE id = ?', [produtoId, item.id]);
      mudaram++;
    }
  }
  return mudaram;
}

export interface LojaParecida {
  id: string;
  nome: string;
  compras: number;
}

/**
 * Outras lojas com nome igual ou parecido, que podem ser a mesma loja guardada duas vezes
 * (o OCR leu o nome diferente). Só aparecem as que podem ser juntadas: duas lojas com CNPJ
 * são sempre lojas diferentes (filiais têm preços próprios).
 */
export async function lojasParecidas(db: BancoSQL, lojaId: string, nome: string): Promise<LojaParecida[]> {
  const lojas = await db.getAllAsync<LojaParecida>(
    `SELECT cnpj_emitente AS id, MAX(nome_emitente) AS nome, COUNT(*) AS compras
       FROM notas WHERE cnpj_emitente <> ? AND nome_emitente IS NOT NULL
      GROUP BY cnpj_emitente`,
    [lojaId],
  );
  return lojas.filter((l) => podeJuntar(lojaId, l.id) && semelhanca(nome, l.nome) >= 0.85);
}

const semCnpj = (id: string) => id.startsWith('loja:');
const podeJuntar = (a: string, b: string) => a !== b && (semCnpj(a) || semCnpj(b));

/**
 * Junta duas lojas que são a mesma. Se uma tem CNPJ, ela fica; as compras da outra
 * passam para ela. Depois, os produtos são reagrupados, para que o mesmo produto das duas
 * "lojas" entre junto nas contas. Devolve o identificador da loja que ficou.
 */
export async function juntarLojas(db: BancoSQL, lojaA: string, lojaB: string, nome: string): Promise<string> {
  if (!podeJuntar(lojaA, lojaB)) {
    throw new Error('Lojas com CNPJ diferentes são lojas diferentes (cada filial tem seus preços).');
  }
  const [fica, sai] = semCnpj(lojaA) && !semCnpj(lojaB) ? [lojaB, lojaA] : [lojaA, lojaB];
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE notas SET cnpj_emitente = ?, nome_emitente = ? WHERE cnpj_emitente IN (?, ?)', [fica, nomeLimpo, fica, sai]);

    // Cupons da foto têm a loja na chave ("foto:loja:X|data|número|total"): troca para a
    // loja que ficou, para que fotografar o mesmo cupom de novo continue sem duplicar.
    const fotos = await db.getAllAsync<{ chave: string }>(
      `SELECT chave FROM notas WHERE cnpj_emitente = ? AND chave LIKE ?`,
      [fica, `foto:${sai}|%`],
    );
    for (const { chave } of fotos) {
      const nova = `foto:${fica}${chave.slice(`foto:${sai}`.length)}`;
      const existe = await db.getFirstAsync<{ chave: string }>('SELECT chave FROM notas WHERE chave = ?', [nova]);
      if (existe) {
        // O mesmo cupom estava salvo nas duas "lojas": fica uma cópia só.
        await db.runAsync('DELETE FROM notas WHERE chave = ?', [chave]);
        continue;
      }
      await db.runAsync(
        `INSERT INTO notas (chave, uf, cnpj_emitente, nome_emitente, data_emissao, valor_total, lida_em, origem)
         SELECT ?, uf, cnpj_emitente, nome_emitente, data_emissao, valor_total, lida_em, origem FROM notas WHERE chave = ?`,
        [nova, chave],
      );
      await db.runAsync('UPDATE itens SET chave_nota = ? WHERE chave_nota = ?', [nova, chave]);
      await db.runAsync('DELETE FROM notas WHERE chave = ?', [chave]);
    }
    await reagruparLoja(db, fica);
  });
  return fica;
}
