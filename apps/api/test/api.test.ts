import { readFileSync } from 'node:fs';
import { lerCupomDoTexto, somaDosItens } from '@dragometro/foto';
import { describe, expect, it } from 'vitest';
import { chavesNoTexto, urlConsultaNoTexto } from '@dragometro/sefaz';
import { criarApp } from '../src/app';

const CHAVE = '35261112345678000195650010000123451876543215';
const html = readFileSync(
  new URL('../../../packages/sefaz/test/fixtures/layout-padrao-sintetico.html', import.meta.url),
  'utf8',
);

function fetchFalso(corpo: string): typeof fetch {
  return (async () => new Response(corpo, { status: 200 })) as typeof fetch;
}

describe('API', () => {
  it('responde /health', async () => {
    const app = await criarApp();
    const r = await app.inject('/health');
    expect(r.json()).toEqual({ ok: true });
  });

  it('consulta a NFC-e a partir do QR Code', async () => {
    const app = await criarApp({ fetchFn: fetchFalso(html) });
    const qr = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|ABC`;
    const r = await app.inject(`/nfce?url=${encodeURIComponent(qr)}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().itens).toHaveLength(2);
  });

  it('recusa endereços fora de .gov.br', async () => {
    const app = await criarApp({ fetchFn: fetchFalso(html) });
    const qr = `https://exemplo.com/qrcode?p=${CHAVE}|2|1|1|ABC`;
    const r = await app.inject(`/nfce?url=${encodeURIComponent(qr)}`);
    expect(r.statusCode).toBe(400);
  });

  it('recusa QR Code sem chave válida', async () => {
    const app = await criarApp();
    const r = await app.inject('/nfce?url=https%3A%2F%2Fsefaz.gov.br%2Fqrcode%3Fp%3D123');
    expect(r.statusCode).toBe(400);
  });

  it('devolve 502 quando o IBGE não responde', async () => {
    const falha = (async () => {
      throw new Error('sem rede');
    }) as typeof fetch;
    const app = await criarApp({ fetchFn: falha });
    const r = await app.inject('/indices/IPCA');
    expect(r.statusCode).toBe(502);
  });

  it('repassa a série de uma categoria do IBGE', async () => {
    const corpo = JSON.stringify([
      { D3C: 'Mês (Código)', V: 'Valor' },
      { D2C: '63', D3C: '202610', D4C: '12393', V: '-0.67' },
    ]);
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(String(url));
      return new Response(corpo, { status: 200 });
    }) as unknown as typeof fetch;
    const app = await criarApp({ fetchFn });
    const r = await app.inject('/indices/IPCA/categoria/12393?ultimos=1');
    expect(r.statusCode).toBe(200);
    expect(r.json().serie['2026-10']).toBeCloseTo(-0.0067, 10);
    expect(urls[0]).toContain('/c315/12393');
    expect((await app.inject('/indices/IPCA/categoria/abc')).statusCode).toBe(400);
  });

  it('lê a chave de acesso da foto do cupom (OCR)', { timeout: 60_000 }, async () => {
    const app = await criarApp();
    const imagem = readFileSync(new URL('./fixtures/rodape-cupom-sintetico.png', import.meta.url));
    const r = await app.inject({
      method: 'POST',
      url: '/ocr',
      payload: { imagemBase64: imagem.toString('base64') },
    });
    expect(r.statusCode).toBe(200);
    const { texto } = r.json() as { texto: string };
    expect(chavesNoTexto(texto).map((c) => c.chave)).toEqual(['35261143259548002298652260000291801000000007']);
    expect(urlConsultaNoTexto(texto)).toBe('https://www.nfce.fazenda.sp.gov.br/consulta');
    await app.close();
  });

  it('lê os itens da foto de um cupom sem chave (OCR + leitor de itens)', { timeout: 60_000 }, async () => {
    const app = await criarApp();
    // Cupom fictício, fotografado torto sobre uma mesa, com luz desigual.
    const imagem = readFileSync(new URL('./fixtures/cupom-sem-chave-sintetico.png', import.meta.url));
    const r = await app.inject({ method: 'POST', url: '/ocr', payload: { imagemBase64: imagem.toString('base64') } });
    expect(r.statusCode).toBe(200);
    const cupom = lerCupomDoTexto((r.json() as { texto: string }).texto);
    expect(cupom.loja.nome).toBe('HORTIFRUTI SOL NASCENTE');
    expect(cupom.dataEmissao).toBe('2026-11-21T08:41:07');
    expect(cupom.numero).toBe('0007788');
    expect(cupom.valorTotal).toBe(51.03);
    expect(cupom.itens.map((i) => [i.descricao, i.quantidade, i.valorUnitario, i.valorTotal])).toEqual([
      ['BATATA LAVADA', 1.235, 5.98, 7.39],
      ['ALFACE CRESPA UND', 1, 3.5, 3.5],
      ['CENOURA', 0.64, 6.49, 4.15],
      ['BANANA NANICA', 1.81, 5.49, 9.94],
      ['COUVE MANTEIGA MACO', 1, 4, 4],
      ['TOMATE ITALIANO', 0.915, 9.98, 9.13],
      ['MELANCIA', 4.32, 2.99, 12.92],
    ]);
    expect(somaDosItens(cupom.itens)).toBe(51.03);
    await app.close();
  });

  it('recusa OCR sem imagem', async () => {
    const app = await criarApp();
    const r = await app.inject({ method: 'POST', url: '/ocr', payload: {} });
    expect(r.statusCode).toBe(400);
  });
});
