import { lerUnidadeCupom, type ItemComprado } from '@dragometro/core';
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
        `INSERT INTO itens (chave_nota, ordem, produto_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
      );
    }
  });
  return resultado;
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
}

/** Notas guardadas, da mais recente para a mais antiga. */
export async function listarNotas(db: BancoSQL): Promise<ResumoNota[]> {
  return db.getAllAsync<ResumoNota>(
    `SELECT n.chave, n.nome_emitente AS nomeEmitente, n.data_emissao AS dataEmissao,
            n.valor_total AS valorTotal, COUNT(i.id) AS quantidadeItens
       FROM notas n LEFT JOIN itens i ON i.chave_nota = n.chave
      GROUP BY n.chave
      ORDER BY n.data_emissao DESC`,
    [],
  );
}

interface LinhaItem {
  produtoId: string;
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
    `SELECT i.produto_id AS produtoId, i.descricao, n.data_emissao AS dataEmissao,
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
  }));
}

export interface ResumoProduto {
  produtoId: string;
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
    `SELECT i.produto_id AS produtoId, MAX(i.descricao) AS descricao, MAX(n.nome_emitente) AS nomeEmitente,
            COUNT(DISTINCT i.chave_nota) AS compras, COUNT(*) AS linhas, ROUND(SUM(i.valor_total), 2) AS gastoTotal,
            MAX(n.data_emissao) AS ultimaCompra
       FROM itens i JOIN notas n ON n.chave = i.chave_nota
      GROUP BY i.produto_id
      ORDER BY compras DESC, ultimaCompra DESC`,
    [],
  );
}
