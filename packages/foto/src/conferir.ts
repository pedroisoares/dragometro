import { digitosDe, distancia, valorDe, variacoes, type NumeroLido } from './numeros';

/** Centavos, para comparar valores sem erro de ponto flutuante. */
const centavos = (v: number) => Math.round(v * 100);

/**
 * O total do item bate com quantidade × preço? Aceita arredondamento e truncamento
 * (impressoras fiscais antigas truncam).
 */
export function contaFecha(quantidade: number, valorUnitario: number, valorTotal: number): boolean {
  const exato = quantidade * valorUnitario * 100;
  const t = centavos(valorTotal);
  return Math.round(exato + 1e-6) === t || Math.floor(exato + 1e-6) === t;
}

/** Limites de bom senso para uma linha de cupom. */
export interface Maximos {
  quantidade?: number;
  /** Preço por unidade ou por kg. Padrão: R$ 500. */
  valorUnitario?: number;
  /** Total do item. Use o total do cupom quando ele for conhecido. */
  valorTotal?: number;
}

export interface LinhaResolvida {
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  /** Quantos dígitos foi preciso mudar, em relação ao que o OCR leu, para a conta fechar. */
  custo: number;
}

/**
 * Acha os valores de uma linha "quantidade × preço = total" que FECHAM A CONTA e ficam
 * mais perto do que o OCR leu.
 *
 * O OCR costuma errar um ou dois dígitos, e a conta diz qual: com 0,230 kg e total 2,76,
 * o preço só pode ser 11,98 a 12,02; se o OCR leu "11,68", o mais provável é 11,98
 * (um dígito trocado). Testamos três hipóteses: dois campos lidos quase certos (até um
 * dígito trocado) e o terceiro calculado pela conta, medindo quantos dígitos ele muda.
 */
export function resolverLinha(
  q: NumeroLido | undefined,
  u: NumeroLido | undefined,
  t: NumeroLido | undefined,
  maximos: Maximos = {},
): LinhaResolvida | undefined {
  return alternativasDaLinha(q, u, t, 1, maximos)[0];
}

/**
 * Todas as combinações que fecham a conta, da mais perto do que foi lido para a mais longe
 * (no máximo `limite`, sem repetir o total). A soma do cupom usa as alternativas para
 * desempatar linhas duvidosas.
 */
export function alternativasDaLinha(
  q: NumeroLido | undefined,
  u: NumeroLido | undefined,
  t: NumeroLido | undefined,
  limite = 6,
  maximos: Maximos = {},
): LinhaResolvida[] {
  const achadas = new Map<string, LinhaResolvida>();
  const { quantidade: maxQ = 50, valorUnitario: maxU = 500, valorTotal: maxT = 5000 } = maximos;
  const considerar = (quantidade: number, valorUnitario: number, valorTotal: number, custo: number) => {
    if (!(quantidade > 0 && valorUnitario > 0 && valorTotal > 0)) return;
    // Bom senso: descarta leituras absurdas (R$ 1.609/kg, item maior que o cupom inteiro).
    if (quantidade > maxQ || valorUnitario > maxU || valorTotal > maxT) return;
    if (!contaFecha(quantidade, valorUnitario, valorTotal)) return;
    // Arredondar é o mais comum; truncar só fecha "de raspão" (custo um pouco maior).
    if (Math.round(quantidade * valorUnitario * 100 + 1e-6) !== centavos(valorTotal)) custo += 0.1;
    const chave = `${quantidade}|${valorUnitario}|${valorTotal}`;
    const atual = achadas.get(chave);
    if (!atual || custo < atual.custo) achadas.set(chave, { quantidade, valorUnitario, valorTotal, custo });
  };
  // Campo que não foi lido: qualquer valor serve, mas custa caro (não há como conferir).
  const custoAusente = 3;
  const custoDe = (n: NumeroLido | undefined, valor: number) =>
    n ? distancia(digitosDe(valor, n.casas), n.digitos) : custoAusente;

  const vq = q ? variacoes(q) : [];
  const vu = u ? variacoes(u) : [];
  const vt = t ? variacoes(t) : [];
  const casasQ = q?.casas ?? 3;
  const casasU = u?.casas ?? 2;

  // 1) quantidade e total lidos → preço calculado
  for (const a of vq) {
    for (const c of vt) {
      const lo = Math.ceil(((c.valor - 0.005) / a.valor) * 10 ** casasU);
      const hi = Math.floor(((c.valor + 0.01) / a.valor) * 10 ** casasU);
      for (let k = lo; k <= hi && k - lo < 40; k++) {
        const preco = k / 10 ** casasU;
        considerar(a.valor, preco, c.valor, a.custo + c.custo + custoDe(u, preco));
      }
    }
  }
  // 2) preço e total lidos → quantidade calculada
  for (const b of vu) {
    for (const c of vt) {
      const lo = Math.ceil(((c.valor - 0.005) / b.valor) * 10 ** casasQ);
      const hi = Math.floor(((c.valor + 0.01) / b.valor) * 10 ** casasQ);
      for (let k = lo; k <= hi && k - lo < 40; k++) {
        const qtd = k / 10 ** casasQ;
        considerar(qtd, b.valor, c.valor, b.custo + c.custo + custoDe(q, qtd));
      }
    }
  }
  // 3) quantidade e preço lidos → total calculado
  for (const a of vq) {
    for (const b of vu) {
      const total = Math.round(a.valor * b.valor * 100 + 1e-6) / 100;
      considerar(a.valor, b.valor, total, a.custo + b.custo + custoDe(t, total));
    }
  }

  const ordenadas = [...achadas.values()].sort((x, y) => x.custo - y.custo);
  const totais = new Set<number>();
  const saida: LinhaResolvida[] = [];
  for (const r of ordenadas) {
    const c = centavos(r.valorTotal);
    if (totais.has(c)) continue;
    totais.add(c);
    saida.push(r);
    if (saida.length >= limite) break;
  }
  return saida;
}

/**
 * Escolhe, entre as alternativas de cada linha duvidosa, a combinação que faz a soma dos
 * itens bater com o total do cupom, mudando o mínimo. Devolve o índice escolhido em cada
 * linha, ou `undefined` se nenhuma combinação bate (ou se houver empate).
 */
export function ajustarPelaSoma(
  linhas: LinhaResolvida[][],
  somaFixa: number,
  totalCupom: number,
): number[] | undefined {
  const alvo = centavos(totalCupom) - centavos(somaFixa);
  let melhor: { escolha: number[]; custo: number } | undefined;
  let empate = false;
  const escolha: number[] = [];
  const visitar = (i: number, soma: number, custo: number) => {
    if (melhor && custo > melhor.custo) return;
    if (i === linhas.length) {
      if (soma !== alvo) return;
      if (melhor && Math.abs(custo - melhor.custo) < 1e-9) empate = true;
      else if (!melhor || custo < melhor.custo) {
        melhor = { escolha: [...escolha], custo };
        empate = false;
      }
      return;
    }
    const atual = linhas[i]![0]!;
    for (const [j, r] of linhas[i]!.entries()) {
      escolha[i] = j;
      // Custo extra em relação ao que já foi escolhido, e um pouquinho por item mudado:
      // entre soluções parecidas, vence a que mexe em menos itens.
      visitar(i + 1, soma + centavos(r.valorTotal), custo + (j === 0 ? 0 : r.custo - atual.custo + 0.01));
    }
  };
  if (linhas.length > 0 && linhas.length <= 8) visitar(0, 0, 0);
  return melhor && !empate ? melhor.escolha : undefined;
}

/** Valores como lidos, sem conferência (quando nenhuma combinação fecha a conta). */
export function semResolver(q?: NumeroLido, u?: NumeroLido, t?: NumeroLido) {
  const quantidade = q ? valorDe(q) : Number.NaN;
  const total = t ? valorDe(t) : Number.NaN;
  const preco = u ? valorDe(u) : Number.NaN;
  // Só mantém peso e preço se fecharem com o total; senão, ficam em branco para a pessoa preencher.
  if (quantidade > 0 && preco > 0 && total > 0 && contaFecha(quantidade, preco, total)) {
    return { quantidade, valorUnitario: preco, valorTotal: total };
  }
  return { quantidade: Number.NaN, valorUnitario: Number.NaN, valorTotal: total };
}
