import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
});
