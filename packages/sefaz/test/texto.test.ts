import { describe, expect, it } from 'vitest';
import { chavesNoTexto, digitosProvaveisDaChave, urlConsultaNoTexto, urlConsultaPorChave } from '../src';

// Chave fictícia válida (a mesma das fixtures de SP).
const CHAVE = '35261143259548002298652260000291801000000007';
const AGRUPADA = '3526 1143 2595 4800 2298 6522 6000 0291 8010 0000 0007';

describe('chave de acesso no texto do OCR', () => {
  it('acha a chave impressa em grupos de 4', () => {
    const texto = `Consulte pela Chave de Acesso em\nhttps://www.nfce.fazenda.sp.gov.br/consulta\nCHAVE DE ACESSO\n${AGRUPADA}\nCONSUMIDOR NÃO IDENTIFICADO`;
    expect(chavesNoTexto(texto).map((c) => c.chave)).toEqual([CHAVE]);
  });

  it('acha a chave quebrada em duas linhas', () => {
    const texto = `Chave de acesso:\n3526 1143 2595 4800 2298 6522\n6000 0291 8010 0000 0007\nProtocolo: 135260078411646`;
    expect(chavesNoTexto(texto)[0]!.chave).toBe(CHAVE);
  });

  it('corrige letras que o OCR confunde com dígitos (O→0, I→1, S→5, B→8)', () => {
    const comErros = '3526 1143 2S95 4BOO 2298 6522 6OOO O291 8O1O OOOO OOO7';
    expect(chavesNoTexto(comErros)[0]!.chave).toBe(CHAVE);
  });

  it('ignora números que não são chave (CNPJ, protocolo, valores)', () => {
    const texto = 'CNPJ: 43.259.548/0022-98\nProtocolo: 135260078411646 14/11/2026\nTOTAL R$ 552,92';
    expect(chavesNoTexto(texto)).toEqual([]);
  });

  it('não aceita a chave com um dígito lido errado, mas sugere os dígitos para corrigir', () => {
    const errada = AGRUPADA.replace('0291', '0391');
    expect(chavesNoTexto(errada)).toEqual([]);
    expect(digitosProvaveisDaChave(`CHAVE DE ACESSO\n${errada}\nCONSUMIDOR`)).toBe(CHAVE.replace('0291', '0391'));
    expect(digitosProvaveisDaChave('TOTAL 552,92')).toBeUndefined();
  });
});

describe('endereço de consulta', () => {
  it('lê o endereço impresso no cupom', () => {
    expect(urlConsultaNoTexto('Consulte pela Chave de Acesso em https://www.nfce.fazenda.sp.gov.br/consulta')).toBe(
      'https://www.nfce.fazenda.sp.gov.br/consulta',
    );
    expect(urlConsultaNoTexto('Acesso em\n\nwww. nfce. fazenda .sp.gov.br/consulta\n')).toBe(
      'https://www.nfce.fazenda.sp.gov.br/consulta',
    );
    expect(urlConsultaNoTexto('Acesso em Www.NFCE.fazenda.sp.gov.br/consulta')).toBe('https://www.nfce.fazenda.sp.gov.br/consulta');
    expect(urlConsultaNoTexto('Consulte em www.sefaz.rs.gov.br/nfce/consulta')).toBe(
      'https://www.sefaz.rs.gov.br/nfce/consulta',
    );
  });

  it('usa o endereço conhecido do estado quando o OCR não leu', () => {
    const [chave] = chavesNoTexto(AGRUPADA);
    expect(urlConsultaPorChave(chave!)).toBe('https://www.nfce.fazenda.sp.gov.br/consulta');
  });
});
