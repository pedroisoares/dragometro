import { consultarNota, type NotaFiscal } from '@dragometro/sefaz';
import { Platform } from 'react-native';

/** Endereço da API do Dragômetro (apps/api). Configure em `.env`: EXPO_PUBLIC_API_URL=http://localhost:3333 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type ResultadoBusca =
  | { tipo: 'nota'; nota: NotaFiscal }
  /** O portal pediu verificação anti-robô: abra a página no WebView (`PaginaSefazOculta`). */
  | { tipo: 'usar-navegador' };

/**
 * Busca a nota a partir do conteúdo do QR Code.
 * - No celular: tenta uma consulta direta à SEFAZ; se o portal devolver a página de
 *   verificação (sem itens), pede para abrir num navegador invisível (WebView).
 *   O cupom não passa pelo nosso servidor.
 * - Na Web: o navegador bloqueia a SEFAZ (CORS), então a consulta passa pela API.
 */
export async function buscarNota(conteudoQr: string): Promise<ResultadoBusca> {
  if (Platform.OS !== 'web') {
    try {
      return { tipo: 'nota', nota: await consultarNota(conteudoQr, fetchComLimite(10_000)) };
    } catch {
      // Página de verificação (sem itens), demora, bloqueio ou erro de rede:
      // em todos os casos o WebView, que se comporta como um navegador, tem mais chance.
      return { tipo: 'usar-navegador' };
    }
  }

  if (!API_URL) {
    throw new Error('Na versão Web é preciso configurar EXPO_PUBLIC_API_URL para consultar a SEFAZ.');
  }
  const resposta = await fetch(`${API_URL}/nfce?url=${encodeURIComponent(conteudoQr)}`);
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(corpo?.erro ?? `A API respondeu ${resposta.status}`);
  }
  return { tipo: 'nota', nota: (await resposta.json()) as NotaFiscal };
}

/** `fetch` que desiste depois de `ms` milissegundos (o portal pode segurar a conexão). */
function fetchComLimite(ms: number): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controle.signal });
    } finally {
      clearTimeout(timer);
    }
  }) as typeof fetch;
}
