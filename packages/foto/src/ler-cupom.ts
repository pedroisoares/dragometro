import { ajustarPelaSoma, alternativasDaLinha, contaFecha, semResolver, type LinhaResolvida, type Maximos } from './conferir';
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
export function lerCupomDoTexto(texto: string, hoje: Date = new Date()): CupomFoto {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s|!]+/, '').replace(/\s+$/, ''))
    .filter(Boolean);

  // O total do cupom vem no fim, mas serve de limite para os itens: leia-o antes.
  const linhaTotal = linhas.find((l) => /^(?:VALOR\s+)?TOTAL\b/i.test(l) && dinheiroNoFim(l));
  const totalLido = linhaTotal ? valorDe(dinheiroNoFim(linhaTotal)!.numero) : Number.NaN;
  const maximos: Maximos = Number.isFinite(totalLido) ? { valorTotal: totalLido } : {};

  const itens: ItemFoto[] = [];
  /** Alternativas que fecham a conta, por item (para o desempate pela soma). */
  const alternativas = new Map<ItemFoto, LinhaResolvida[]>();
  let pendente: { descricao: string } | undefined;
  let valorTotal: number | undefined;
  const pagamentos: number[] = [];
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
      // Linhas de pagamento logo abaixo (CARTÃO, DINHEIRO...) repetem o total: segunda opinião.
      for (const l of linhas.slice(i + 1, i + 4)) {
        const p = /TROCO/i.test(l) ? undefined : dinheiroNoFim(l);
        if (p) pagamentos.push(valorDe(p.numero));
      }
      break;
    }

    if (pendente) {
      const detalhe = lerDetalhe(linha, maximos);
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
  if (valorTotal !== undefined) {
    // O total também pode ter sido mal lido ("184,76" no lugar de "164,76"). Entre o TOTAL e
    // os pagamentos, fica o que bate com os itens mexendo menos (empate: vale o TOTAL).
    let melhor: { total: number; plano: PlanoSoma } | undefined;
    for (const total of [valorTotal, ...pagamentos]) {
      if (!Number.isFinite(total)) continue;
      const plano = planoPelaSoma(itens, alternativas, total);
      if (plano && (!melhor || plano.custo < melhor.plano.custo)) melhor = { total, plano };
    }
    if (melhor) {
      melhor.plano.aplicar();
      valorTotal = melhor.total;
    }
  }

  const cabecalho = linhas.slice(0, inicioItens < 0 ? linhas.length : inicioItens);
  return {
    loja: lerLoja(cabecalho, texto),
    ...opcional('numero', /\b(?:CUPOM|COO|CCF)\b\D{0,8}(\d{3,10})/i.exec(texto)?.[1]),
    ...opcional('dataEmissao', lerDataHora(texto, hoje)),
    itens,
    ...opcional('valorTotal', valorTotal),
  };
}

interface PlanoSoma {
  /** Quanto foi preciso mexer nos itens para a soma bater (0 = já batia). */
  custo: number;
  aplicar: () => void;
}

/**
 * Se a soma não bate com o total do cupom, tenta as outras contas possíveis das linhas
 * duvidosas. Devolve o plano que faz a soma bater mexendo menos, ou `undefined`.
 */
function planoPelaSoma(itens: ItemFoto[], alternativas: Map<ItemFoto, LinhaResolvida[]>, total: number): PlanoSoma | undefined {
  if (Math.round(somaDosItens(itens) * 100) === Math.round(total * 100)) return { custo: 0, aplicar: () => {} };
  if (alternativas.size === 0) return undefined;
  // Primeiro só os itens "conferir"; se não resolver, inclui os "ajustado".
  for (const grupo of [['conferir'], ['conferir', 'ajustado']]) {
    const duvidosos = [...alternativas.keys()].filter((i) => grupo.includes(i.situacao));
    const opcoes = duvidosos.map((i) => alternativas.get(i)!);
    const somaFixa = somaDosItens(itens.filter((i) => !duvidosos.includes(i)));
    const escolha = ajustarPelaSoma(opcoes, somaFixa, total);
    if (!escolha) continue;
    const custo = escolha.reduce((c, j, k) => c + (j === 0 ? 0 : opcoes[k]![j]!.custo - opcoes[k]![0]!.custo + 0.01), 0);
    return {
      custo,
      aplicar: () => {
        for (const [k, item] of duvidosos.entries()) {
          if (escolha[k] === 0) continue;
          const r = opcoes[k]![escolha[k]!]!;
          item.quantidade = r.quantidade;
          item.valorUnitario = r.valorUnitario;
          item.valorTotal = r.valorTotal;
          // Confirmado pela soma do cupom: provavelmente certo, mas a pessoa ainda pode olhar.
          item.situacao = 'ajustado';
        }
      },
    };
  }
  return undefined;
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

/** Um campo de dinheiro: dígitos (ou letras confundíveis), com 2 casas. `?` = dígito ilegível. */
function lerDinheiro(campo: string): NumeroLido | undefined {
  const limpo = campo.replace(/[«»'"`]/g, '').trim();
  if (!/^[\dOoDUIl|SsBG&?,. ]+[=:]?$/.test(limpo) || !/\d/.test(limpo)) return undefined;
  const n = lerNumero(limpo, 2);
  if (!n) return undefined;
  // Casas a mais ("22,688") são dígito repetido pelo OCR: a conferência remove o que sobra.
  const digitos = n.casas < 2 ? n.digitos + '0'.repeat(2 - n.casas) : n.digitos;
  // Sem separador, precisa de ao menos 3 dígitos ("822" = 8,22).
  return digitos.length >= 3 ? { digitos, casas: 2 } : undefined;
}

/** "0001 LIMAO TAHITI" ou "0002 OVO VERMELHO 30 UN BDJ    22,90". */
function lerCabecalhoItem(linha: string): { descricao: string; total?: NumeroLido } | undefined {
  const m = /^([0-9A-Za-z&]{3,6})\s+(.*)$/.exec(linha);
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
function lerDetalhe(linha: string, maximos: Maximos): (Omit<ItemFoto, 'descricao'> & { alternativas: LinhaResolvida[] }) | undefined {
  const dinheiro = dinheiroNoFim(linha) ?? dinheiroAposUltimoEspaco(linha);
  if (!dinheiro) return undefined;
  const partes = separarQuantidadePreco(dinheiro.resto.trim());
  if (!partes) return undefined;

  const textoQtd = inicioNumerico(partes.quantidade);
  const digitosQtd = textoQtd.replace(/[\s,.]/g, '');
  // Sem unidade legível: 4+ dígitos ou 3 casas é peso ("0345", "0,965"); senão, unidades.
  const unidade: UnidadeFoto =
    partes.unidade ?? (digitosQtd.length >= 4 || /[,.]\s*\S{3}$/.test(textoQtd) ? 'KG' : 'UN');
  const q = textoQtd ? lerNumero(textoQtd, unidade === 'UN' ? 0 : 3) : undefined;
  const lido = lerNumero(partes.preco, 2);
  // Preço tem sempre 2 casas: "11,6G8" é um dígito a mais do OCR, não R$ 11,668.
  const preco = lido && lido.casas !== 2 ? { digitos: lido.digitos.padEnd(lido.digitos.length + 2 - lido.casas, '0'), casas: 2 } : lido;
  const t = dinheiro.numero;
  if (!q && !preco) return undefined;
  const unidadeFinal: UnidadeFoto = unidade === 'UN' && q?.casas === 3 ? 'KG' : unidade;

  const alternativas = alternativasDaLinha(q, preco, t, 6, maximos);
  const r = alternativas[0];
  // Muito longe do que foi lido (4+ dígitos mudados): melhor não inventar. Fica o total
  // lido, e a pessoa completa peso e preço na revisão.
  if (r && r.custo < 4) {
    const custo = Math.round(r.custo);
    return {
      quantidade: r.quantidade,
      unidade: unidadeFinal,
      valorUnitario: r.valorUnitario,
      valorTotal: r.valorTotal,
      situacao: custo === 0 ? 'ok' : custo === 1 ? 'ajustado' : 'conferir',
      alternativas,
    };
  }
  const lidos = semResolver(q, preco, t);
  const comoLido: LinhaResolvida = { ...lidos, custo: 0 };
  return { ...lidos, unidade: unidadeFinal, situacao: 'conferir', alternativas: [comoLido, ...alternativas] };
}

/**
 * Separa "0,230 KG X 11,98 =" em quantidade, unidade e preço. O OCR troca o "X" por
 * "Y", "A" ou some com ele, e lê "KG" como "K6", "K3", "KB"...
 */
function separarQuantidadePreco(texto: string): { quantidade: string; unidade?: UnidadeFoto; preco: string } | undefined {
  const comUnidade = /^(.{1,10}?)\s*(K[GB36S]?|UND?|LT?)\s*(?:[xXyYaA×*%]\s*|\s+)(.+)$/.exec(texto);
  if (comUnidade) {
    const u = comUnidade[2]!.toUpperCase();
    return {
      quantidade: comUnidade[1]!,
      unidade: u.startsWith('K') ? 'KG' : u.startsWith('L') ? 'L' : 'UN',
      preco: comUnidade[3]!,
    };
  }
  const soX = /^(.{1,12})\s*[xX×]\s*(.+)$/.exec(texto);
  return soX ? { quantidade: soX[1]!, preco: soX[2]! } : undefined;
}

/** O começo numérico de um texto: "OSS5XBG" → "OSS5" (para no primeiro caractere que não vira dígito). */
function inicioNumerico(texto: string): string {
  return /^[\s\dOoQDUCcIli|!LZzSsGbTB&?,.]*/.exec(texto.trim())![0].trim();
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

/**
 * Primeira data válida do texto, com a hora logo depois, se houver ("07/11/2026-10.09 58").
 * O OCR às vezes repete um dígito do ano ("20286"): vale o ano possível que não seja futuro.
 */
function lerDataHora(texto: string, hoje: Date): string | undefined {
  const anoAtual = hoje.getFullYear();
  const re = /(\d{2})\/(\d{2})\/(\d{4,5}|\d{2})(?!\d)(?:\D{1,3}(\d{2})[:.\s](\d{2})(?:[:.\s](\d{2}))?)?/g;
  for (const m of texto.matchAll(re)) {
    const [, d, mes, a, h, min, s] = m;
    const candidatos = a!.length === 2 ? [`20${a}`] : a!.length === 4 ? [a!] : [...a!].map((_, i) => a!.slice(0, i) + a!.slice(i + 1));
    const ano = candidatos.find((x) => Number(x) >= 2000 && Number(x) <= anoAtual);
    if (!ano || Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) continue;
    const data = `${ano}-${mes}-${d}`;
    if (h && Number(h) < 24 && Number(min) < 60 && (!s || Number(s) < 60)) return `${data}T${h}:${min}:${s ?? '00'}`;
    return data;
  }
  return undefined;
}
