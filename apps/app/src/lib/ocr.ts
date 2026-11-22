import { urlDaApi } from './api';

/**
 * Motor de OCR: recebe a foto e devolve o TEXTO reconhecido. O que fazer com o texto
 * (achar a chave de acesso, o endereço de consulta...) fica no pacote `sefaz`
 * (`chavesNoTexto`, `urlConsultaNoTexto`), que roda no app.
 *
 * Hoje o OCR roda na API (Tesseract), o que funciona no Expo Go. Para rodar no celular
 * no futuro (ex.: ML Kit, que exige um build próprio do app), basta criar outro motor
 * com esta mesma interface e trocá-lo em `motorOcr`.
 */
export interface MotorOcr {
  nome: string;
  reconhecer(imagem: { base64: string }): Promise<string>;
}

export const motorOcrApi: MotorOcr = {
  nome: 'api',
  async reconhecer({ base64 }) {
    const api = urlDaApi();
    if (!api) throw new Error('Para ler fotos, configure EXPO_PUBLIC_API_URL e deixe a API rodando (pnpm api).');
    let resposta: Response;
    try {
      resposta = await fetch(`${api}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagemBase64: base64 }),
      });
    } catch {
      throw new Error(`Não foi possível falar com a API em ${api}. Ela está rodando (pnpm api)?`);
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      throw new Error(corpo?.erro ?? `A API respondeu ${resposta.status}`);
    }
    return ((await resposta.json()) as { texto: string }).texto;
  },
};

/** O motor em uso. Troque aqui quando houver OCR no próprio celular. */
export const motorOcr: MotorOcr = motorOcrApi;
