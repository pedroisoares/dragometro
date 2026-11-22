import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ajustarPelaSoma,
  alternativasDaLinha,
  cnpjValido,
  contaFecha,
  lerCupomDoTexto,
  lerNumero,
  maisParecido,
  resolverLinha,
  semelhanca,
  situacaoAposEdicao,
  somaDosItens,
} from '../src';

const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');

describe('lerNumero', () => {
  it('lê com vírgula, ponto, espaço e sem separador', () => {
    expect(lerNumero('0,345', 3)).toEqual({ digitos: '0345', casas: 3 });
    expect(lerNumero('4 90', 2)).toEqual({ digitos: '490', casas: 2 });
    expect(lerNumero('0 130', 3)).toEqual({ digitos: '0130', casas: 3 });
    expect(lerNumero('1890=', 2)).toEqual({ digitos: '1890', casas: 2 });
    expect(lerNumero('5.26', 2)).toEqual({ digitos: '526', casas: 2 });
  });

  it('troca letras confundíveis por dígitos', () => {
    expect(lerNumero('O057C', 3)).toEqual({ digitos: '00570', casas: 3 });
    expect(lerNumero('4 &2', 2)).toEqual({ digitos: '482', casas: 2 });
  });
});

describe('conferência da conta', () => {
  it('aceita arredondamento e truncamento', () => {
    expect(contaFecha(0.345, 16.98, 5.86)).toBe(true); // 5,8581
    expect(contaFecha(0.685, 18.9, 12.95)).toBe(true); // 12,9465
    expect(contaFecha(0.685, 18.9, 12.94)).toBe(true); // truncado
    expect(contaFecha(0.685, 18.9, 12.9)).toBe(false);
  });

  it('corrige o dígito que o OCR errou usando a conta', () => {
    // 0,230 kg × "11,68" ≠ 2,76; só um preço entre 11,98 e 12,02 fecha, e 11,98 muda um dígito.
    const r = resolverLinha(lerNumero('0,230', 3), lerNumero('11,68', 2), lerNumero('2,76', 2));
    expect(r).toMatchObject({ quantidade: 0.23, valorUnitario: 11.98, valorTotal: 2.76, custo: 1 });
  });

  it('calcula o total quando ele não foi lido', () => {
    const r = resolverLinha(lerNumero('0330', 3), lerNumero('2490', 2), undefined);
    expect(r).toMatchObject({ quantidade: 0.33, valorUnitario: 24.9, valorTotal: 8.22 });
  });

  it('desempata pela soma do cupom', () => {
    const a = alternativasDaLinha(lerNumero('0,420', 3), lerNumero('8400', 2), lerNumero('22,88', 2));
    expect(a.length).toBeGreaterThan(1);
    const escolha = ajustarPelaSoma([a], 142.08, 164.76)!;
    expect(a[escolha[0]!]).toMatchObject({ valorUnitario: 54, valorTotal: 22.68 });
  });
});

describe('lerCupomDoTexto', () => {
  // Texto real do OCR de um cupom de verdurão (sem QR Code, sem chave, sem CNPJ),
  // com loja, endereço, número, data e atendente trocados por fictícios.
  const cupom = lerCupomDoTexto(fixture('hortifruti-ocr-real.txt'));

  it('lê o cabeçalho', () => {
    expect(cupom.loja.nome).toMatch(/^HORTIFRUTI BOA COLHEITA/);
    expect(cupom.loja.endereco).toBe('RUA DAS ACACIAS, 1OO');
    expect(cupom.loja.telefone).toBe('(11) 5555-0100');
    expect(cupom.loja.cnpj).toBeUndefined();
    expect(cupom.numero).toBe('0004521');
    expect(cupom.dataEmissao).toBe('2026-11-14T09:12:33');
    expect(cupom.valorTotal).toBe(164.76);
  });

  it('lê os 16 itens e a soma bate com o total', () => {
    expect(cupom.itens).toHaveLength(16);
    expect(somaDosItens(cupom.itens)).toBe(164.76);
  });

  it('acerta itens por quilo, inclusive os corrigidos pela conta e pela soma', () => {
    const item = (inicio: string) => cupom.itens.find((i) => i.descricao.startsWith(inicio))!;
    expect(item('LIMAO')).toMatchObject({ quantidade: 0.345, unidade: 'KG', valorUnitario: 16.98, valorTotal: 5.86 });
    expect(item('MACA')).toMatchObject({ quantidade: 0.345, valorUnitario: 7.9, valorTotal: 2.73 });
    expect(item('TOMATE')).toMatchObject({ quantidade: 0.685, valorUnitario: 18.9, valorTotal: 12.95, situacao: 'ok' });
    expect(item('CEBOLA')).toMatchObject({ quantidade: 0.23, valorUnitario: 11.98, valorTotal: 2.76 });
    expect(item('PESSEGO')).toMatchObject({ quantidade: 0.33, valorUnitario: 24.9, valorTotal: 8.22 });
    expect(item('MANGA')).toMatchObject({ quantidade: 0.57, valorUnitario: 10.98, valorTotal: 6.26 });
    expect(item('BANANA')).toMatchObject({ quantidade: 1.585, valorUnitario: 7.9, valorTotal: 12.52 });
    expect(item('MINAS')).toMatchObject({ quantidade: 0.42, valorUnitario: 54, valorTotal: 22.68 });
  });

  it('itens de uma linha só ficam com quantidade 1', () => {
    const ovo = cupom.itens.find((i) => i.descricao.startsWith('OVO'))!;
    expect(ovo).toMatchObject({ quantidade: 1, unidade: 'UN', valorUnitario: 22.9, valorTotal: 22.9, situacao: 'sem-conta' });
    expect(cupom.itens.find((i) => i.descricao.startsWith('ACELGA'))?.valorTotal).toBe(4.9);
  });

  it('marca para conferir o que não deu para acertar', () => {
    // "OSSSKBGX 40G=" (0,965 kg × 4,99): o total está certo, peso e preço não.
    const laranja = cupom.itens.find((i) => i.descricao.startsWith('LARANJA'))!;
    expect(laranja.valorTotal).toBe(4.82);
    expect(laranja.situacao).toBe('conferir');
  });

  it('acha o CNPJ quando impresso', () => {
    const c = lerCupomDoTexto('MERCADO EXEMPLO\nCNPJ: 11.222.333/0001-81\n0001 ARROZ 5KG    24,90\nTOTAL   24,90');
    expect(c.loja.cnpj).toBe('11222333000181');
    expect(c.itens).toHaveLength(1);
  });
});

describe('lerCupomDoTexto com foto de celular torta', () => {
  // O mesmo cupom fotografado em alta resolução e inclinado (texto do OCR depois de endireitar),
  // com os dados da loja trocados. O OCR troca "X" por "Y" e "A", lê "22,688", "82?" e o ano "20286".
  const cupom = lerCupomDoTexto(fixture('hortifruti-ocr-celular-torto.txt'), new Date('2026-11-22T12:00:00'));
  const item = (inicio: string) => cupom.itens.find((i) => i.descricao.startsWith(inicio))!;

  it('não se confunde com o ano lido com um dígito a mais', () => {
    expect(cupom.dataEmissao).toBe('2026-11-14T09:12:33');
  });

  it('acerta todos os totais e a soma bate com o total do cupom', () => {
    expect(cupom.itens).toHaveLength(16);
    expect(cupom.valorTotal).toBe(164.76);
    expect(somaDosItens(cupom.itens)).toBe(164.76);
  });

  it('entende "KG Y", "KG A" e totais com dígito a mais', () => {
    expect(item('CEBOLA')).toMatchObject({ quantidade: 0.23, valorUnitario: 11.98, valorTotal: 2.76 });
    expect(item('MANGA')).toMatchObject({ quantidade: 0.57, valorUnitario: 10.98, valorTotal: 6.26 });
    expect(item('PESSEGO')).toMatchObject({ quantidade: 0.33, valorUnitario: 24.9, valorTotal: 8.22 });
    expect(item('MINAS')).toMatchObject({ quantidade: 0.42, valorUnitario: 54, valorTotal: 22.68 });
  });

  it('não inventa peso e preço quando não dá para ler: deixa em branco para a pessoa', () => {
    // "HARAS KGX 160908:  5,86": o peso é ilegível.
    const limao = item('LIMAO');
    expect(limao.valorTotal).toBe(5.86);
    expect(limao.quantidade).toBeNaN();
    expect(limao.situacao).toBe('conferir');
  });
});

describe('total do cupom mal lido', () => {
  it('usa a linha de pagamento quando ela bate com os itens e o TOTAL não', () => {
    const c = lerCupomDoTexto(
      ['0001 ARROZ 5KG        24,90', '0002 FEIJAO 1KG        8,49', 'TOTAL           38,39', 'DINHEIRO        33,39', 'TROCO            0,00'].join('\n'),
    );
    expect(c.valorTotal).toBe(33.39);
  });
});

describe('situacaoAposEdicao', () => {
  it('volta a ficar ok quando a pessoa corrige', () => {
    expect(situacaoAposEdicao({ quantidade: 0.965, valorUnitario: 4.99, valorTotal: 4.82 })).toBe('ok');
    expect(situacaoAposEdicao({ quantidade: 4.555, valorUnitario: 4.99, valorTotal: 4.82 })).toBe('conferir');
  });
});

describe('semelhança', () => {
  it('ignora espaços e acentos', () => {
    expect(semelhanca('ACEL GA UND', 'Acelga und')).toBe(1);
    expect(semelhanca('VERDURAO SOL NASCENTF', 'VERDURÃO SOL NASCENTE')).toBeGreaterThan(0.9);
    expect(maisParecido('PESSEGO NACIONAI', ['PESSEGO NACIONAL', 'MANGA PALMER'], (x) => x)).toBe('PESSEGO NACIONAL');
    expect(maisParecido('LARANJA PERA', ['LARANJA LIMA'], (x) => x)).toBeUndefined();
  });

  it('valida CNPJ', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
  });
});
