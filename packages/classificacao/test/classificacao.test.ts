import { describe, expect, it } from 'vitest';
import { categoria, categoriasDoNivel, classificar, itemDoSubitem, normalizar, REGRAS } from '../src';

const nome = (descricao: string) => classificar(descricao)?.nome ?? null;

describe('catálogo do IBGE', () => {
  it('tem os subitens e os códigos do SIDRA', () => {
    expect(categoria('1111004')).toEqual({ codigo: '1111004', sidra: '12393', nome: 'Leite longa vida' });
    expect(categoria('11')?.nome).toBe('Alimentação no domicílio');
    expect(itemDoSubitem('1107089')?.nome).toBe('Carnes');
    expect(categoriasDoNivel('subitem').length).toBeGreaterThan(170);
  });

  it('toda regra aponta para um subitem que existe no catálogo', () => {
    for (const [subitem] of REGRAS) {
      if (subitem) expect(categoria(subitem), subitem).toBeDefined();
    }
  });
});

describe('normalização', () => {
  it('tira acentos e pontuação', () => {
    expect(normalizar('Pão Francês (kg)')).toBe('PAO FRANCES KG');
  });
});

describe('itens reais dos cupons de SP', () => {
  it.each([
    // Supermercado
    ['PRES COZ SADIA S CP BAND KG', 'Presunto'],
    ['QJ M FRESC BANDEIRA PT KG', 'Queijo'],
    ['MINAS FRESCAL BONANI', 'Queijo'],
    ['LIMAO TAHITI', 'Limão'],
    ['MAMAO FORMOSA', 'Mamão'],
    ['PAO FRANCES KG', 'Pão francês'],
    ['QJ PRATO MONTE CASTELO GRAN KG', 'Queijo'],
    ['CR DEN COLGATE MPA MEN 120', 'Produto para higiene bucal'],
    ['BOM LACTA S VALSA OURO BCO220', 'Chocolate em barra e bombom'],
    ['CHOC LACTA AO LEITE 80G', 'Chocolate em barra e bombom'],
    ['CAFE BRASILEIRO TRAD POUC500', 'Café moído'],
    ['ESPON ACO BOMBRIL ECO C6', 'Esponja de limpeza'],
    ['LIMP VEJA ORIG OF IMPER 500 C3', 'Limpador multiuso'],
    ['BAT PALHA YOKI TRAD E ECO 380G', null],
    ['IOG GRE BATAVO MOR TRAD 510', 'Iogurte e bebidas lácteas'],
    ['SARDINHA G COSTA 75G', 'Sardinha em conserva'],
    ['BISC BAUD CHOCBIS CHOC LEIT 80', 'Biscoito'],
    ['PAO CRANB QUIN HIB NUTRELLA350', 'Pão de forma'],
    ['PAO INTEG CAS QUIN NUTRELLA350', 'Pão de forma'],
    ['QJ MUSSAR TIROLEZ FAT 150G', 'Queijo'],
    ['CR LEITE ITAMBE LT 300G', null],
    ['SAL REFIN LEBRE 1KG', 'Sal'],
    ['LEITE IN XANDO INT TIPO A2GFA1', 'Leite longa vida'],
    ['ARROZ B LEGAL AGULH 5KG', 'Arroz'],
    ['MILHO FUGINI SCH 170G', 'Milho-verde em conserva'],
    ['BISC POLV CASSINI 200G', 'Biscoito'],
    ['PH FAMILIAR FD N 30 L16P15', 'Papel higiênico'],
    // Açougue
    ['PATINHO KG', 'Patinho'],
    ['FILE FRANGO KG', 'Frango em pedaços'],
    ['ALCATRA KG', 'Alcatra'],
  ])('%s → %s', (descricao, esperado) => {
    expect(nome(descricao)).toBe(esperado);
  });
});

describe('outros casos comuns', () => {
  it.each([
    ['LEITE UHT INTEGRAL 1L', 'Leite longa vida'],
    ['LEITE COND MOCOCA 395G', 'Leite condensado'],
    ['LEITE DE COCO SOCOCO 200ML', 'Leite de coco'],
    ['FEIJAO CARIOCA KICALDO 1KG', 'Feijão - carioca (rajado)'],
    ['FEIJAO PRETO CAMIL 1KG', 'Feijão - preto'],
    ['ACUCAR REFINADO UNIAO 1KG', 'Açúcar refinado'],
    ['OLEO SOJA LIZA 900ML', 'Óleo de soja'],
    ['OVOS BRANCOS GRANDES DZ', 'Ovo de galinha'],
    ['BANANA PRATA KG', 'Banana - prata'],
    ['BANANA NANICA KG', "Banana - d'água"],
    ['TOMATE ITALIANO KG', 'Tomate'],
    ['BATATA LAVADA KG', 'Batata-inglesa'],
    ['REFRIG COCA COLA 2L', 'Refrigerante e água mineral'],
    ['CERV SKOL LATA 350ML', 'Cerveja'],
    ['DETERG YPE NEUTRO 500ML', 'Detergente'],
    ['SABAO PO OMO 1,6KG', 'Sabão em pó'],
    ['SABONETE DOVE 90G', 'Sabonete'],
    ['MACARRAO ESPAGUETE RENATA 500G', 'Macarrão'],
    ['MIOJO GALINHA 85G', 'Macarrão instantâneo'],
    ['MILHO PIPOCA YOKI 500G', 'Milho (em grão)'],
    ['FRANGO INTEIRO RESFRIADO KG', 'Frango inteiro'],
    ['ACHOC NESCAU 400G', 'Chocolate e achocolatado em pó'],
  ])('%s → %s', (descricao, esperado) => {
    expect(nome(descricao)).toBe(esperado);
  });

  it('devolve null quando não reconhece', () => {
    expect(classificar('XPTO 123')).toBeNull();
  });
});
