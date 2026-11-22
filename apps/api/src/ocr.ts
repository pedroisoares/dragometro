import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createWorker, OEM, type Worker } from 'tesseract.js';

/**
 * OCR na API, com Tesseract (tesseract.js) e o modelo de português empacotado no npm
 * (@tesseract.js-data/por): não baixa nada da internet e roda em qualquer sistema.
 *
 * A API só devolve o TEXTO reconhecido. Achar a chave de acesso nesse texto é trabalho
 * de `chavesNoTexto` (pacote sefaz), que roda no app. Assim, quando o OCR passar a rodar
 * no celular, só a fonte do texto muda.
 */

const require = createRequire(import.meta.url);
const dadosPor = require('@tesseract.js-data/por') as { langPath: string; gzip: boolean };

let worker: Promise<Worker> | null = null;

function obterWorker(): Promise<Worker> {
  // Um worker só, criado na primeira foto e reaproveitado (carregar o modelo é a parte lenta).
  worker ??= createWorker('por', OEM.LSTM_ONLY, {
    langPath: dadosPor.langPath,
    gzip: dadosPor.gzip,
    cachePath: tmpdir(),
  });
  return worker;
}

/**
 * Prepara a foto para o OCR: gira conforme a orientação gravada pela câmera (EXIF),
 * passa para tons de cinza, estica o contraste (papel térmico desbotado) e amplia
 * imagens pequenas (fotos comprimidas pelo WhatsApp, por exemplo).
 */
async function prepararImagem(imagem: Buffer): Promise<Buffer> {
  const base = sharp(imagem).rotate();
  const { width = 0 } = await base.metadata();
  const largura = width < 2000 ? Math.min(width * 2, 4000) : undefined;
  return base
    .grayscale()
    .normalize()
    .resize(largura ? { width: largura } : undefined)
    .sharpen()
    .png()
    .toBuffer();
}

export async function reconhecerTexto(imagem: Buffer): Promise<string> {
  const w = await obterWorker();
  // rotateAuto: corrige fotos tiradas um pouco tortas.
  const { data } = await w.recognize(await prepararImagem(imagem), { rotateAuto: true });
  return data.text;
}

export async function encerrarOcr(): Promise<void> {
  if (!worker) return;
  const w = await worker;
  worker = null;
  await w.terminate();
}
