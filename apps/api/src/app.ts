import cors from '@fastify/cors';
import { variacaoMensal, subitens, type Indice } from '@dragometro/ibge';
import { chaveDoQrCode, consultarNota } from '@dragometro/sefaz';
import Fastify, { type FastifyInstance } from 'fastify';

export interface OpcoesApp {
  /** Permite trocar o fetch nos testes. */
  fetchFn?: typeof fetch;
  logger?: boolean;
}

const INDICES: readonly Indice[] = ['IPCA', 'INPC'];

/**
 * API do Dragômetro. Por enquanto ela:
 *  - faz a ponte com a SEFAZ para a versão Web (o navegador bloqueia a chamada direta);
 *  - repassa os índices do IBGE.
 * Próximos passos: contas, sincronização e banco PostgreSQL.
 */
export async function criarApp({ fetchFn = fetch, logger = false }: OpcoesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true }));

  app.get<{ Querystring: { url?: string } }>('/nfce', async (req, reply) => {
    const url = req.query.url;
    if (!url) return reply.code(400).send({ erro: 'Informe ?url= com o conteúdo do QR Code' });

    let destino: URL;
    try {
      chaveDoQrCode(url); // garante que é mesmo um QR de NFC-e
      destino = new URL(url);
    } catch {
      return reply.code(400).send({ erro: 'QR Code de NFC-e inválido' });
    }
    // Só consultamos portais de governo, para a API não virar um proxy aberto.
    if (destino.protocol !== 'https:' && destino.protocol !== 'http:') {
      return reply.code(400).send({ erro: 'Endereço inválido' });
    }
    if (!destino.hostname.endsWith('.gov.br')) {
      return reply.code(400).send({ erro: 'O QR Code não aponta para um portal .gov.br' });
    }

    try {
      return await consultarNota(destino.toString(), fetchFn);
    } catch (e) {
      req.log.warn(e);
      return reply.code(502).send({ erro: e instanceof Error ? e.message : 'Falha ao consultar a SEFAZ' });
    }
  });

  app.get<{ Params: { indice: string }; Querystring: { ultimos?: string } }>(
    '/indices/:indice',
    async (req, reply) => {
      const indice = req.params.indice.toUpperCase() as Indice;
      if (!INDICES.includes(indice)) return reply.code(404).send({ erro: 'Use IPCA ou INPC' });
      const ultimos = Math.min(Math.max(Number(req.query.ultimos ?? 12) || 12, 1), 120);
      const serie = await variacaoMensal(indice, { ultimos }, fetchFn);
      return { indice, serie: Object.fromEntries(serie) };
    },
  );

  app.get<{ Params: { indice: string } }>('/indices/:indice/subitens', async (req, reply) => {
    const indice = req.params.indice.toUpperCase() as Indice;
    if (!INDICES.includes(indice)) return reply.code(404).send({ erro: 'Use IPCA ou INPC' });
    return { indice, subitens: await subitens(indice, { ultimos: 1 }, fetchFn) };
  });

  return app;
}
