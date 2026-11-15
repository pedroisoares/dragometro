import { parse } from 'node-html-parser';
import { lerDataHoraBR, lerNumeroBR } from '../numeros';
import type { ChaveAcesso, ItemNota, LeitorSefaz, NotaFiscal } from '../tipos';

/**
 * Layout de consulta da NFC-e usado por vários estados: uma tabela `#tabResult`
 * com uma linha por item e os campos em spans com as classes
 * `txtTit` (descrição), `RCod` (código), `Rqtd` (quantidade), `RUN` (unidade),
 * `RvlUnit` (valor unitário) e `valor` (valor total do item).
 *
 * Validado com páginas reais de: SP (test/fixtures/sp-*.html).
 * Quem tiver cupons de outro estado: salve a página em `test/fixtures/<uf>.html`
 * e abra um PR (veja CONTRIBUTING.md).
 */
export const layoutPadrao: LeitorSefaz = {
  nome: 'layout-padrao',
  // Estados já validados com páginas reais. Adicione o seu junto com a fixture e o teste.
  ufs: ['SP'],
  ler(html: string, chave: ChaveAcesso): NotaFiscal {
    const doc = parse(html);
    const texto = (seletor: string, raiz = doc) => raiz.querySelector(seletor)?.text.trim() ?? '';
    const semRotulo = (s: string) => s.replace(/^[^:]*:\s*/, '').trim();

    const itens: ItemNota[] = [];
    for (const linha of doc.querySelectorAll('#tabResult tr')) {
      const descricao = texto('.txtTit', linha);
      const valorTotal = texto('.valor', linha);
      if (!descricao || !valorTotal) continue;

      const codigo = /(\d+)/.exec(texto('.RCod', linha))?.[1];
      itens.push({
        codigo,
        descricao,
        quantidade: lerNumeroBR(semRotulo(texto('.Rqtd', linha))),
        unidade: semRotulo(texto('.RUN', linha)) || 'UN',
        valorUnitario: lerNumeroBR(semRotulo(texto('.RvlUnit', linha))),
        valorTotal: lerNumeroBR(valorTotal),
      });
    }
    if (itens.length === 0) throw new Error('Nenhum item encontrado na página da SEFAZ');

    const textoPagina = doc.text.replace(/\s+/g, ' ');
    const totalNota = /Valor a pagar R\$:?\s*([\d.,]+)/i.exec(textoPagina)?.[1];

    return {
      chave: chave.chave,
      uf: chave.uf,
      emitente: {
        nome: texto('#u20') || texto('.txtTopo') || undefined,
        cnpj: chave.cnpjEmitente,
      },
      dataEmissao: lerDataHoraBR(/Emiss[ãa]o:?\s*([\d/]+\s+[\d:]+)/i.exec(textoPagina)?.[1] ?? ''),
      itens,
      valorTotal: totalNota ? lerNumeroBR(totalNota) : itens.reduce((s, i) => s + i.valorTotal, 0),
    };
  },
};
