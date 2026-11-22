import { ajustarPelaSoma, alternativasDaLinha, contaFecha, semResolver, type LinhaResolvida } from './conferir';
import { comoDigitos, lerNumero, valorDe, type NumeroLido } from './numeros';

export type UnidadeFoto = 'UN' | 'KG' | 'L';

/**
 * Situação de um item depois da conferência:
 * - `ok`: a conta (quantidade × preço = total) fecha com o que o OCR leu;
 * - `ajustado`: fechou trocando um dígito (quase sempre certo, mas vale olhar);
 * - `conferir`: foi preciso mudar mais coisa, ou não deu para conferir. A pessoa confere na revisão;
 * - `sem-conta`: item de uma linha só (quantidade 1, sem preço por kg): não há conta para conferir.
 */
export type SituacaoItem = 'ok' | 'ajustado' | 'conferir' | 'sem-conta';

export interface ItemFoto {
  descricao: string;
  quantidade: number;
  unidade: UnidadeFoto;
  valorUnitario: number;
  valorTotal: number;
  situacao: SituacaoItem;
}

export interface CupomFoto {
  loja: { nome?: string; cnpj?: string; endereco?: string; telefone?: string };
  /** Número do cupom (COO, "Cupom Nº"), quando impresso. */
  numero?: string;
  /** Data e hora no formato ISO local (`2026-11-07T10:09:58`), ou só a data. */
  dataEmissao?: string;
  itens: ItemFoto[];
  /** Total do cupom, como impresso. */
  valorTotal?: number;
}

/** Soma dos totais dos itens, em reais (arredondada em centavos). */
export function somaDosItens(itens: Pick<ItemFoto, 'valorTotal'>[]): number {
  return Math.round(itens.reduce((s, i) => s + (Number.isFinite(i.valorTotal) ? i.valorTotal : 0), 0) * 100) / 100;
}

/** Situação de um item depois que a pessoa editou os valores. */
export function situacaoAposEdicao(item: Pick<ItemFoto, 'quantidade' | 'valorUnitario' | 'valorTotal'>): 'ok' | 'conferir' {
  return item.quantidade > 0 && item.valorUnitario > 0 && item.valorTotal > 0 && contaFecha(item.quantidade, item.valorUnitario, item.valorTotal)
    ? 'ok'
    : 'conferir';
}

/**
 * Lê um cupom a partir do texto do OCR: loja, data, número, itens e total.
 *
 * Pensado para os cupons de caixa comuns (mercados, verdurões, padarias): cada item começa
 * com um número de sequência ("0001 LIMAO TAHITI") e tem o total na ponta direita, na mesma
 * linha ou na linha de baixo, junto com "quantidade KG X preço =". Itens de quantidade 1
 * costumam vir numa linha só. Todo valor lido passa pela conferência da conta.
 */
export function lerCupomDoTexto(texto: string): CupomFoto {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s|!]+/, '').replace(/\s+$/, ''))
    .filter(Boolean);

  const itens: ItemFoto[] = [];
  /** Alternativas que fecham a conta, por item (para o desempate pela soma). */
  const alternativas = new Map<ItemFoto, LinhaResolvida[]>();
  let pendente: { descricao: string } | undefined;
  let valorTotal: number | undefined;
  let inicioItens = -1;

  const fecharPendente = () => {
    if (!pendente) return;
    // Item sem linha de detalhe nem valor: entra para a pessoa completar.
    itens.push({ descricao: pendente.descricao, quantidade: 1, unidade: 'UN', valorUnitario: Number.NaN, valorTotal: Number.NaN, situacao: 'conferir' });
    pendente = undefined;
  };

  for (const [i, linha] of linhas.entries()) {
    if (/^(?:VALOR\s+)?TOTAL\b/i.test(linha) && itens.length + (pendente ? 1 : 0) > 0) {
      fecharPendente();
      const v = dinheiroNoFim(linha);
      if (v) valorTotal = valorDe(v.numero);
      break;
    }

    if (pendente) {
      const detalhe = lerDetalhe(linha);
      if (detalhe) {
        const { alternativas: alt, ...valores } = detalhe;
        const item = { descricao: pendente.descricao, ...valores };
        itens.push(item);
        if (alt.length > 1 && item.situacao !== 'ok') alternativas.set(item, alt);
        pendente = undefined;
        continue;
      }
    }

    const cabecalho = lerCabecalhoItem(linha);
    if (cabecalho) {
      fecharPendente();
      if (inicioItens < 0) inicioItens = i;
      if (cabecalho.total) {
        const total = valorDe(cabecalho.total);
        itens.push({
          descricao: cabecalho.descricao,
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: total,
          valorTotal: total,
          situacao: Number.isFinite(total) ? 'sem-conta' : 'conferir',
        });
      } else {
        pendente = { descricao: cabecalho.descricao };
      }
    }
  }
  fecharPendente();
  if (valorTotal !== undefined) desempatarPelaSoma(itens, alternativas, valorTotal);

  const cabecalho = linhas.slice(0, inicioItens < 0 ? linhas.length : inicioItens);
  return {
    loja: lerLoja(cabecalho, texto),
    ...opcional('numero', /\b(?:CUPOM|COO|CCF)\b\D{0,8}(\d{3,10})/i.exec(texto)?.[1]),
    ...opcional('dataEmissao', lerDataHora(texto)),
    itens,
    ...opcional('valorTotal', valorTotal),
  };
}

/**
 * Se a soma não bate com o total do cupom, tenta as outras contas possíveis das linhas
 * duvidosas. Quando uma combinação única faz a soma bater, ela é aplicada.
 */
function desempatarPelaSoma(itens: ItemFoto[], alternativas: Map<ItemFoto, LinhaResolvida[]>, total: number) {
  if (Math.round(somaDosItens(itens) * 100) === Math.round(total * 100) || alternativas.size === 0) return;
  const duvidosos = [...alternativas.keys()];
  const somaFixa = somaDosItens(itens.filter((i) => !alternativas.has(i)));
  const escolha = ajustarPelaSoma(duvidosos.map((i) => alternativas.get(i)!), somaFixa, total);
  if (!escolha) return;
  for (const [k, item] of duvidosos.entries()) {
    const r = alternativas.get(item)![escolha[k]!]!;
    if (escolha[k] === 0) continue;
    item.quantidade = r.quantidade;
    item.valorUnitario = r.valorUnitario;
    item.valorTotal = r.valorTotal;
    // Confirmado pela soma do cupom: provavelmente certo, mas a pessoa ainda pode olhar.
    item.situacao = 'ajustado';
  }
}

function opcional<K extends string, V>(chave: K, valor: V | undefined): { [P in K]?: V } {
  return (valor === undefined ? {} : { [chave]: valor }) as { [P in K]?: V };
}

/** Valor em dinheiro na ponta direita da linha (separado do resto por 2+ espaços, ou com vírgula). */
function dinheiroNoFim(linha: string): { numero: NumeroLido; resto: string } | undefined {
  const partes = linha.split(/\s{2,}/);
  if (partes.length > 1) {
    const numero = lerDinheiro(partes.at(-1)!);
    if (numero) return { numero, resto: partes.slice(0, -1).join('  ') };
  }
  const m = /^(.*\S)\s+(\d{1,4}[,.]\s?\d{2})$/.exec(linha);
  if (m) {
    const numero = lerNumero(m[2]!, 2);
    if (numero) return { numero, resto: m[1]! };
  }
  return undefined;
}

/** Um campo de dinheiro: dígitos (ou letras confundíveis), com 2 casas. */
function lerDinheiro(campo: string): NumeroLido | undefined {
  const limpo = campo.replace(/[«»'"`]/g, '').trim();
  if (!/^[\dOoDUIl|SsBG&,. ]+[=:]?$/.test(limpo) || !/\d/.test(limpo)) return undefined;
  const n = lerNumero(limpo, 2);
  // Sem separador, precisa de ao menos 3 dígitos ("822" = 8,22).
  return n && n.digitos.length >= 3 && n.casas === 2 ? n : undefined;
}

/** "0001 LIMAO TAHITI" ou "0002 OVO VERMELHO 30 UN BDJ    22,90". */
function lerCabecalhoItem(linha: string): { descricao: string; total?: NumeroLido } | undefined {
  const m = /^([0-9A-Za-z&]{3,5})\s+(.*)$/.exec(linha);
  if (!m) return undefined;
  const seq = comoDigitos(m[1]!);
  if (seq.includes('?')) return undefined;
  const dinheiro = dinheiroNoFim(m[2]!);
  const descricao = limparDescricao(dinheiro ? dinheiro.resto : m[2]!);
  // Descrição precisa ter palavras de verdade (não só números e unidades).
  if ((descricao.match(/[A-Za-zÀ-ú]/g)?.length ?? 0) < 3) return undefined;
  return { descricao, ...(dinheiro ? { total: dinheiro.numero } : {}) };
}

function limparDescricao(texto: string): string {
  return texto
    .replace(/[^\p{L}\p{N}\s.,/%-]/gu, ' ')
    .replace(/[\s.,:;-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** "0,345 KG X 16,98 =    5,86" (e as variações que o OCR produz). */
function lerDetalhe(linha: string): (Omit<ItemFoto, 'descricao'> & { alternativas: LinhaResolvida[] }) | undefined {
  const m = /^(.{1,12}?)\s*[xX×]\s*(.+)$/.exec(linha);
  if (!m) return undefined;
  const esquerda = m[1]!;
  const dinheiro = dinheiroNoFim(m[2]!) ?? dinheiroAposUltimoEspaco(m[2]!);
  if (!dinheiro) return undefined;

  // Quantidade e unidade: "0,345 KG", "0 130KG", "1585K3", "2 UN".
  const u = /(K|UN|UND|LT?)\b|K/i.exec(esquerda);
  const unidade: UnidadeFoto = !u ? 'UN' : /^K/i.test(u[0]) ? 'KG' : /^L/i.test(u[0]) ? 'L' : 'UN';
  const textoQtd = u ? esquerda.slice(0, u.index) : esquerda;
  const q = lerNumero(textoQtd, unidade === 'UN' ? 0 : 3);
  if (!q || q.digitos.replace(/\?/g, '').length === 0) return undefined;
  const preco = lerNumero(dinheiro.resto, 2);
  const t = dinheiro.numero;
  const unidadeFinal: UnidadeFoto = unidade === 'UN' && q.casas === 3 ? 'KG' : unidade;

  const alternativas = alternativasDaLinha(q, preco, t);
  const r = alternativas[0];
  if (r) {
    return {
      quantidade: r.quantidade,
      unidade: unidadeFinal,
      valorUnitario: r.valorUnitario,
      valorTotal: r.valorTotal,
      situacao: r.custo === 0 ? 'ok' : r.custo === 1 ? 'ajustado' : 'conferir',
      alternativas,
    };
  }
  return { ...semResolver(q, preco, t), unidade: unidadeFinal, situacao: 'conferir', alternativas };
}

/** Quando o total não está separado por 2+ espaços: "2490= 822". */
function dinheiroAposUltimoEspaco(texto: string): { numero: NumeroLido; resto: string } | undefined {
  const m = /^(.*\S)\s+(\S+)$/.exec(texto.trim());
  if (!m) return undefined;
  const numero = lerDinheiro(m[2]!);
  return numero ? { numero, resto: m[1]! } : undefined;
}

function lerLoja(cabecalho: string[], texto: string): CupomFoto['loja'] {
  const loja: CupomFoto['loja'] = {};
  const nome = cabecalho.find((l) => {
    const letras = l.match(/\p{L}/gu)?.length ?? 0;
    return letras >= 4 && letras / l.replace(/\s/g, '').length >= 0.7 && !/^(CNPJ|IE|CUPOM|TEL)/i.test(l);
  });
  if (nome) loja.nome = nome.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/\s+/g, ' ');
  const endereco = cabecalho.find((l) => /^(R\.|RUA|AV\.?|AVENIDA|ROD\.?|RODOVIA|ESTR\.?|ESTRADA|AL\.?|ALAMEDA|PRA[ÇC]A|P[CÇ]A|TRAV\.?|TRAVESSA)\s/i.test(l));
  if (endereco) loja.endereco = endereco.replace(/\s+/g, ' ');
  const telefone = /(?:TEL|FONE)\D{0,12}?(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i.exec(cabecalho.join('\n'))?.[1];
  if (telefone) loja.telefone = telefone;
  const cnpj = /CNPJ\D{0,6}([\dOoDIl|.\/\- ]{14,22})/i.exec(texto)?.[1];
  if (cnpj) {
    const digitos = comoDigitos(cnpj.replace(/[.\/\-\s]/g, ''));
    if (cnpjValido(digitos)) loja.cnpj = digitos;
  }
  return loja;
}

/** Dígitos verificadores do CNPJ. */
export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((s, d, i) => s + Number(d) * pesos[i]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(cnpj.slice(0, 12));
  const d2 = dv(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

/** Primeira data válida do texto, com a hora logo depois, se houver ("07/11/2026-10.09 58"). */
function lerDataHora(texto: string): string | undefined {
  const re = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})(?:\D{1,3}(\d{2})[:.\s](\d{2})(?:[:.\s](\d{2}))?)?/g;
  for (const m of texto.matchAll(re)) {
    const [, d, mes, a, h, min, s] = m;
    const ano = a!.length === 2 ? `20${a}` : a!;
    if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31 || Number(ano) < 2000) continue;
    const data = `${ano}-${mes}-${d}`;
    if (h && Number(h) < 24 && Number(min) < 60 && (!s || Number(s) < 60)) return `${data}T${h}:${min}:${s ?? '00'}`;
    return data;
  }
  return undefined;
}
