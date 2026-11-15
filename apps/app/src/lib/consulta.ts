import { consultarNota, type NotaFiscal } from '@dragometro/sefaz';
import { Platform } from 'react-native';

/** Endereço da API do Dragômetro (apps/api). Configure em `.env`: EXPO_PUBLIC_API_URL=http://localhost:3333 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Busca a nota a partir do conteúdo do QR Code.
 * - No celular, a consulta vai direto do aparelho para a SEFAZ (o cupom não passa pelo nosso servidor).
 * - Na Web, o navegador bloqueia a SEFAZ (CORS), então a consulta passa pela API.
 */
export async function buscarNota(conteudoQr: string): Promise<NotaFiscal> {
  if (Platform.OS !== 'web') return consultarNota(conteudoQr);

  if (!API_URL) {
    throw new Error('Na versão Web é preciso configurar EXPO_PUBLIC_API_URL para consultar a SEFAZ.');
  }
  const resposta = await fetch(`${API_URL}/nfce?url=${encodeURIComponent(conteudoQr)}`);
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status}`);
  return (await resposta.json()) as NotaFiscal;
}
