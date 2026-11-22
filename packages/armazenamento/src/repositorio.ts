import { classificar } from '@dragometro/classificacao';
import { lerUnidadeCupom, type ItemComprado } from '@dragometro/core';
import { chaveDeComparacao, maisParecido, somaDosItens } from '@dragometro/foto';
import { lerChave, type ItemNota, type NotaFiscal } from '@dragometro/sefaz';
import type { BancoSQL } from './banco';

/**
 * Identifica "o mesmo produto" entre compras. Por enquanto: o código interno da loja,
 * que só vale dentro da mesma loja (CNPJ). Comparar lojas diferentes vai exigir
 * código de barras ou classificação nos subitens do IPCA.
 */
export function idProduto(cnpjEmitente: string, item: Pick<ItemNota, 'codigo' | 'descricao'>): string {
  const sufixo = item.codigo?.trim() || item.descricao.trim().toUpperCase().replace(/\s+/g, ' ');
  return `${cnpjEmitente}:${sufixo}`;
}

export type ResultadoSalvar = 'nova' | 'repetida';

/** Salva a nota e os itens. Se a nota já existe (mesma chave), não grava de novo. */
export async function salvarNota(
  db: BancoSQL,
  nota: NotaFiscal,
  lidaEm: string = new Date().toISOString(),
): Promise<ResultadoSalvar> {
  // Sem data na página, usamos o mês da chave de acesso.
  const dataEmissao = nota.dataEmissao ?? `${lerChave(nota.chave).anoMes}-01`;
  let resultado: ResultadoSalvar = 'repetida';

  await db.withTransactionAsync(async () => {
    const { changes } = await db.runAsync(
      `INSERT OR IGNORE INTO notas (chave, uf, cnpj_emitente, nome_emitente, data_emissao, valor_total, lida_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nota.chave, nota.uf, nota.emitente.cnpj, nota.emitente.nome ?? null, dataEmissao, nota.valorTotal ?? null, lidaEm],
    );
    if (changes === 0) return;

    resultado = 'nova';
    for (const [ordem, item] of nota.itens.entries()) {
      await db.runAsync(
        `INSERT INTO itens (chave_nota, ordem, produto_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_total, subitem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nota.chave,
          ordem + 1,
          idProduto(nota.emitente.cnpj, item),
          item.codigo ?? null,
          item.descricao,
          item.quantidade,
          item.unidade,
          item.valorUnitario,
          item.valorTotal,
          classificar(item.descricao)?.codigo ?? null,
        ],
      );
    }
  });
  return resultado;
}

/** Um cupom lido pela foto e revisado pela pessoa, pronto para salvar. */
export interface CupomParaSalvar {
  loja: { nome: string; cnpj?: string };
  numero?: string;
  /** ISO local: `2026-11-07T10:09:58` ou `2026-11-07`. */
  dataEmissao: string;
  valorTotal?: number;
  itens: { descricao: string; quantidade: number; unidade: string; valorUnitario: number; valorTotal: number }[];
}

export interface LojaGuardada {
  /** CNPJ, ou `loja:NOME` para lojas sem CNPJ no cupom. */
  id: string;
  nome: string;
}

/**
 * A loja de um cupom lido pela foto. Com CNPJ, é o CNPJ. Sem CNPJ, procura uma loja já
 * guardada com nome parecido (o OCR pode ler "NASCENTF" numa semana e "NASCENTE" na outra);
 * se não houver, cria `loja:NOME`.
 */
export async function acharLoja(db: BancoSQL, nome: string, cnpj?: string): Promise<LojaGuardada> {
  const lojas = await db.getAllAsync<{ id: string; nome: string | null }>(
    `SELECT cnpj_emitente AS id, MAX(nome_emitente) AS nome FROM notas GROUP BY cnpj_emitente`,
    [],
  );
  if (cnpj) {
    const mesma = lojas.find((l) => l.id === cnpj);
    return { id: cnpj, nome: mesma?.nome ?? nome };
  }
  const parecida = maisParecido(nome, lojas.filter((l) => l.nome), (l) => l.nome!);
  if (parecida) return { id: parecida.id, nome: parecida.nome! };
  return { id: `loja:${chaveDeComparacao(nome)}`, nome };
}

/**
 * Salva um cupom lido pela foto. A chave é criada pelo app (loja, data, número e total),
 * então o mesmo cupom fotografado de novo não é gravado duas vezes. Itens com descrição
 * parecida com a de um produto já comprado na mesma loja entram como o MESMO produto,
 * para a variação de preço funcionar semana a semana.
 */
export async function salvarCupomFoto(
  db: BancoSQL,
  cupom: CupomParaSalvar,
  lidaEm: string = new Date().toISOString(),
): Promise<ResultadoSalvar> {
  const loja = await acharLoja(db, cupom.loja.nome, cupom.loja.cnpj);
  const total = cupom.valorTotal ?? somaDosItens(cupom.itens);
  const chave = `foto:${loja.id}|${cupom.dataEmissao}|${cupom.numero ?? ''}|${total.toFixed(2)}`;
  const produtos = await db.getAllAsync<{ produtoId: string; descricao: string }>(
    `SELECT i.produto_id AS produtoId, MAX(i.descricao) AS descricao
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      WHERE n.cnpj_emitente = ?
      GROUP BY i.produto_id`,
    [loja.id],
  );
  let resultado: ResultadoSalvar = 'repetida';

  await db.withTransactionAsync(async () => {
    const { changes } = await db.runAsync(
      `INSERT OR IGNORE INTO notas (chave, uf, cnpj_emitente, nome_emitente, data_emissao, valor_total, lida_em, origem)
       VALUES (?, '', ?, ?, ?, ?, ?, 'foto')`,
      [chave, loja.id, loja.nome, cupom.dataEmissao, total, lidaEm],
    );
    if (changes === 0) return;

    resultado = 'nova';
    for (const [ordem, item] of cupom.itens.entries()) {
      const descricao = item.descricao.trim().toUpperCase().replace(/\s+/g, ' ');
      const mesmo = maisParecido(descricao, produtos, (p) => p.descricao);
      const produtoId = mesmo?.produtoId ?? `${loja.id}:${chaveDeComparacao(descricao)}`;
      if (!mesmo) produtos.push({ produtoId, descricao });
      await db.runAsync(
        `INSERT INTO itens (chave_nota, ordem, produto_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_total, subitem)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        [
          chave,
          ordem + 1,
          produtoId,
          descricao,
          item.quantidade,
          item.unidade,
          item.valorUnitario,
          item.valorTotal,
          classificar(descricao)?.codigo ?? null,
        ],
      );
    }
  });
  return resultado;
}

export interface ItemDaNota {
  ordem: number;
  produtoId: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  /** Subitem do IPCA, ou null se não foi classificado. */
  subitem: string | null;
}

export interface DetalheNota extends ResumoNota {
  /** CNPJ da loja, ou `loja:NOME` para lojas sem CNPJ. */
  lojaId: string;
  itens: ItemDaNota[];
}

/** Um cupom guardado, com os itens na ordem do cupom. */
export async function detalheNota(db: BancoSQL, chave: string): Promise<DetalheNota | null> {
  const nota = await db.getFirstAsync<Omit<DetalheNota, 'itens' | 'quantidadeItens'>>(
    `SELECT chave, cnpj_emitente AS lojaId, nome_emitente AS nomeEmitente, data_emissao AS dataEmissao,
            valor_total AS valorTotal, origem
       FROM notas WHERE chave = ?`,
    [chave],
  );
  if (!nota) return null;
  const itens = await db.getAllAsync<ItemDaNota>(
    `SELECT ordem, produto_id AS produtoId, descricao, quantidade, unidade, valor_unitario AS valorUnitario,
            valor_total AS valorTotal, subitem
       FROM itens WHERE chave_nota = ? ORDER BY ordem`,
    [chave],
  );
  return { ...nota, quantidadeItens: itens.length, itens };
}

/**
 * Corrige o nome de uma loja em todas as compras dela. Para lojas sem CNPJ, os próximos
 * cupons lidos pela foto com nome parecido também caem nessa loja (veja `acharLoja`).
 */
export async function renomearLoja(db: BancoSQL, lojaId: string, nome: string): Promise<void> {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (!limpo) throw new Error('O nome da loja não pode ficar vazio.');
  await db.runAsync('UPDATE notas SET nome_emitente = ? WHERE cnpj_emitente = ?', [limpo, lojaId]);
}

export async function excluirNota(db: BancoSQL, chave: string): Promise<void> {
  await db.runAsync('DELETE FROM notas WHERE chave = ?', [chave]);
}

export interface ResumoNota {
  chave: string;
  nomeEmitente: string | null;
  dataEmissao: string;
  valorTotal: number | null;
  quantidadeItens: number;
  /** 'sefaz' (QR Code ou chave de acesso) ou 'foto' (itens lidos da foto). */
  origem: 'sefaz' | 'foto';
}

/** Notas guardadas, da mais recente para a mais antiga. */
export async function listarNotas(db: BancoSQL): Promise<ResumoNota[]> {
  return db.getAllAsync<ResumoNota>(
    `SELECT n.chave, n.nome_emitente AS nomeEmitente, n.data_emissao AS dataEmissao,
            n.valor_total AS valorTotal, COUNT(i.id) AS quantidadeItens, n.origem
       FROM notas n LEFT JOIN itens i ON i.chave_nota = n.chave
      GROUP BY n.chave
      ORDER BY n.data_emissao DESC`,
    [],
  );
}

interface LinhaItem {
  produtoId: string;
  subitem: string | null;
  descricao: string;
  dataEmissao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

/**
 * Todos os itens comprados, no formato do pacote `core`, prontos para
 * `observacoesDeItens`, `variacaoDoItem`, `pesosPorGasto` e `indicePessoal`.
 * Opcionalmente filtra por produto.
 */
export async function itensComprados(db: BancoSQL, produtoId?: string): Promise<ItemComprado[]> {
  const linhas = await db.getAllAsync<LinhaItem>(
    `SELECT i.produto_id AS produtoId, i.subitem, i.descricao, n.data_emissao AS dataEmissao,
            i.quantidade, i.unidade, i.valor_unitario AS valorUnitario, i.valor_total AS valorTotal
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      ${produtoId ? 'WHERE i.produto_id = ?' : ''}
      ORDER BY n.data_emissao, i.ordem`,
    produtoId ? [produtoId] : [],
  );
  return linhas.map((l) => ({
    produtoId: l.produtoId,
    descricao: l.descricao,
    data: l.dataEmissao.slice(0, 10),
    quantidade: l.quantidade,
    unidade: lerUnidadeCupom(l.unidade),
    valorUnitario: l.valorUnitario,
    valorTotal: l.valorTotal,
    ...(l.subitem ? { categoria: l.subitem } : {}),
  }));
}

export interface ResumoProduto {
  produtoId: string;
  /** Subitem do IPCA (código do IBGE), ou null se não foi classificado. */
  subitem: string | null;
  descricao: string;
  nomeEmitente: string | null;
  /** Em quantas notas o produto aparece. */
  compras: number;
  /** Quantas linhas de cupom o produto ocupa (ex.: 7 pesagens de frango num só cupom). */
  linhas: number;
  gastoTotal: number;
  ultimaCompra: string;
}

/** Produtos já comprados, dos mais frequentes para os menos. */
export async function listarProdutos(db: BancoSQL): Promise<ResumoProduto[]> {
  return db.getAllAsync<ResumoProduto>(
    `SELECT i.produto_id AS produtoId, MAX(i.subitem) AS subitem, MAX(i.descricao) AS descricao, MAX(n.nome_emitente) AS nomeEmitente,
            COUNT(DISTINCT i.chave_nota) AS compras, COUNT(*) AS linhas, ROUND(SUM(i.valor_total), 2) AS gastoTotal,
            MAX(n.data_emissao) AS ultimaCompra
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      GROUP BY i.produto_id
      ORDER BY compras DESC, ultimaCompra DESC`,
    [],
  );
}

export interface GastoCategoria {
  /** Subitem do IPCA, ou null para itens sem classificação. */
  subitem: string | null;
  gasto: number;
  itens: number;
}

/** Quanto foi gasto em cada subitem do IPCA (para pesos e para a tela de gastos). */
export async function gastosPorCategoria(db: BancoSQL): Promise<GastoCategoria[]> {
  return db.getAllAsync<GastoCategoria>(
    `SELECT subitem, ROUND(SUM(valor_total), 2) AS gasto, COUNT(*) AS itens
       FROM itens GROUP BY subitem ORDER BY gasto DESC`,
    [],
  );
}
