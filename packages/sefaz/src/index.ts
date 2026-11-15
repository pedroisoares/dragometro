import { chaveDoQrCode } from './chave';
import { leitorPara } from './leitores';
import type { NotaFiscal } from './tipos';

export * from './tipos';
export * from './chave';
export * from './numeros';
export { ErroSemItens, estadoValidado, leitorPara, layoutPadrao } from './leitores';

/** Extrai a nota a partir do HTML da página de consulta, escolhendo o leitor pela UF da chave. */
export function lerNotaDaPagina(html: string, conteudoQrOuChave: string): NotaFiscal {
  const chave = chaveDoQrCode(conteudoQrOuChave);
  return leitorPara(chave.uf).ler(html, chave);
}

/**
 * Abre o endereço do QR Code (que aponta para a SEFAZ do estado) e lê a nota.
 * No celular, rode isto no próprio aparelho; na Web, o navegador bloqueia (CORS)
 * e a chamada precisa passar pela API.
 */
export async function consultarNota(
  urlQrCode: string,
  fetchFn: typeof fetch = fetch,
): Promise<NotaFiscal> {
  const resposta = await fetchFn(urlQrCode, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      // Alguns portais recusam clientes que não se parecem com um navegador.
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    },
  });
  if (!resposta.ok) throw new Error(`SEFAZ respondeu ${resposta.status}`);
  return lerNotaDaPagina(await resposta.text(), urlQrCode);
}
