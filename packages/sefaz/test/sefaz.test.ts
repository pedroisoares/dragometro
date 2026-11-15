import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calcularDV,
  chaveDoQrCode,
  chaveValida,
  consultarNota,
  lerChave,
  lerDataHoraBR,
  lerNotaDaPagina,
  lerNumeroBR,
} from '../src';

// Chave fictícia com dígito verificador correto (SP, nov/2026, NFC-e modelo 65).
const CHAVE = '35261112345678000195650010000123451876543215';
const html = readFileSync(new URL('./fixtures/layout-padrao-sintetico.html', import.meta.url), 'utf8');

describe('chave de acesso', () => {
  it('calcula o dígito verificador (módulo 11)', () => {
    expect(calcularDV(CHAVE.slice(0, 43))).toBe(5);
  });

  it('valida a chave mesmo com espaços, como vem do OCR', () => {
    expect(chaveValida('3526 1112 3456 7800 0195 6500 1000 0123 4518 7654 3215')).toBe(true);
    expect(chaveValida(CHAVE.slice(0, 43) + '9')).toBe(false);
    expect(chaveValida('123')).toBe(false);
  });

  it('separa os campos', () => {
    const c = lerChave(CHAVE);
    expect(c.uf).toBe('SP');
    expect(c.anoMes).toBe('2026-11');
    expect(c.cnpjEmitente).toBe('12345678000195');
    expect(c.modelo).toBe('65');
    expect(c.numero).toBe('000012345');
  });

  it('extrai a chave dos formatos de QR Code', () => {
    const v2 = `https://www.sefaz.exemplo.gov.br/nfce/qrcode?p=${CHAVE}|2|1|1|ABCDEF0123456789`;
    const v1 = `https://www.sefaz.exemplo.gov.br/nfce?chNFe=${CHAVE}&nVersao=100&tpAmb=1`;
    expect(chaveDoQrCode(v2).chave).toBe(CHAVE);
    expect(chaveDoQrCode(v1).chave).toBe(CHAVE);
    expect(() => chaveDoQrCode('https://exemplo.com')).toThrow();
  });
});

describe('números e datas', () => {
  it('lê números no formato brasileiro', () => {
    expect(lerNumeroBR('1.234,56')).toBe(1234.56);
    expect(lerNumeroBR('R$ 5,69')).toBe(5.69);
    expect(lerNumeroBR('2')).toBe(2);
  });

  it('lê data e hora', () => {
    expect(lerDataHoraBR('15/11/2026 13:25:00')).toBe('2026-11-15T13:25:00');
  });
});

describe('leitor do layout padrão', () => {
  it('extrai itens, emitente, data e total', () => {
    const nota = lerNotaDaPagina(html, CHAVE);
    expect(nota.uf).toBe('SP');
    expect(nota.emitente.nome).toBe('SUPERMERCADO EXEMPLO LTDA');
    expect(nota.dataEmissao).toBe('2026-11-15T13:25:00');
    expect(nota.valorTotal).toBe(20.01);
    expect(nota.itens).toEqual([
      {
        codigo: '7891234567890',
        descricao: 'LEITE UHT INTEGRAL 1L',
        quantidade: 2,
        unidade: 'UN',
        valorUnitario: 5.69,
        valorTotal: 11.38,
      },
      {
        codigo: '2001',
        descricao: 'BANANA PRATA',
        quantidade: 1.235,
        unidade: 'KG',
        valorUnitario: 6.99,
        valorTotal: 8.63,
      },
    ]);
  });

  it('consulta pelo endereço do QR Code usando o fetch informado', async () => {
    const fetchFalso = (async () => new Response(html, { status: 200 })) as typeof fetch;
    const nota = await consultarNota(`https://sefaz.exemplo/qrcode?p=${CHAVE}|2|1|1|X`, fetchFalso);
    expect(nota.itens).toHaveLength(2);
  });
});
