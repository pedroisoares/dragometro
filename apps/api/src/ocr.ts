import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';

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
  worker ??= (async () => {
    const w = await createWorker('por', OEM.LSTM_ONLY, {
      langPath: dadosPor.langPath,
      gzip: dadosPor.gzip,
      cachePath: tmpdir(),
    });
    await w.setParameters({
      // Cupom = um bloco só de texto. O modo automático separa a coluna de valores
      // da descrição e perde a ligação entre o item e o preço.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      // Mantém os espaços largos entre a descrição e o valor (ajuda a achar as colunas).
      preserve_interword_spaces: '1',
    });
    return w;
  })();
  return worker;
}

/** Largura de trabalho: texto de cupom fica legível para o Tesseract perto disso. */
const LARGURA_ALVO = 1800;
const LARGURA_MAXIMA = 2600;

/**
 * Prepara a foto para o OCR:
 * 1. gira conforme a orientação gravada pela câmera (EXIF) e passa para tons de cinza;
 * 2. recorta só o papel (a parte clara), tirando a mesa em volta, que vira "texto" lixo;
 * 3. amplia fotos pequenas (WhatsApp) e reduz as muito grandes;
 * 4. uniformiza a iluminação: divide cada ponto pela média da vizinhança. Sombra e
 *    papel térmico desbotado deixam de atrapalhar.
 */
export async function prepararImagem(imagem: Buffer): Promise<Buffer> {
  const { data: cinza, info } = await sharp(imagem)
    .rotate()
    .removeAlpha()
    .grayscale()
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const recorte = recortePapel(cinza, info.width, info.height);

  const fator = Math.min(recorte.width < LARGURA_ALVO ? Math.min(2, LARGURA_ALVO / recorte.width) : 1, LARGURA_MAXIMA / recorte.width);
  const largura = Math.round(recorte.width * fator);
  const { data: px, info: dim } = await sharp(cinza, { raw: { width: info.width, height: info.height, channels: 1 } })
    .extract(recorte)
    .resize({ width: largura, kernel: 'lanczos3' })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const fundo = await sharp(px, { raw: { width: dim.width, height: dim.height, channels: 1 } })
    .blur(Math.max(8, Math.round(12 * fator)))
    .extractChannel(0)
    .raw()
    .toBuffer();
  const saida = Buffer.alloc(px.length);
  for (let i = 0; i < px.length; i++) saida[i] = Math.min(255, Math.round((px[i]! / Math.max(1, fundo[i]!)) * 255));

  return sharp(saida, { raw: { width: dim.width, height: dim.height, channels: 1 } }).png().toBuffer();
}

/**
 * Retângulo do papel: linhas e colunas em que a maior parte dos pontos é clara
 * (limiar de Otsu). Se o "papel" achado for pequeno demais, usa a imagem inteira.
 */
function recortePapel(px: Buffer, largura: number, altura: number) {
  const inteira = { left: 0, top: 0, width: largura, height: altura };
  const limiar = limiarOtsu(px);
  const claroCol = new Uint32Array(largura);
  const claroLin = new Uint32Array(altura);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (px[y * largura + x]! > limiar) {
        claroCol[x]!++;
        claroLin[y]!++;
      }
    }
  }
  const cols = [...claroCol.keys()].filter((x) => claroCol[x]! > altura / 2);
  const lins = [...claroLin.keys()].filter((y) => claroLin[y]! > largura / 2);
  if (!cols.length || !lins.length) return inteira;
  const r = { left: cols[0]!, top: lins[0]!, width: cols.at(-1)! - cols[0]! + 1, height: lins.at(-1)! - lins[0]! + 1 };
  return r.width * r.height < 0.2 * largura * altura || r.width < 200 ? inteira : r;
}

function limiarOtsu(px: Buffer): number {
  const hist = new Float64Array(256);
  for (const v of px) hist[v]!++;
  const total = px.length;
  let soma = 0;
  for (let t = 0; t < 256; t++) soma += t * hist[t]!;
  let somaFundo = 0, pesoFundo = 0, melhor = 0, limiar = 127;
  for (let t = 0; t < 256; t++) {
    pesoFundo += hist[t]!;
    if (pesoFundo === 0 || pesoFundo === total) continue;
    somaFundo += t * hist[t]!;
    const mF = somaFundo / pesoFundo;
    const mP = (soma - somaFundo) / (total - pesoFundo);
    const v = pesoFundo * (total - pesoFundo) * (mF - mP) ** 2;
    if (v > melhor) { melhor = v; limiar = t; }
  }
  return limiar;
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
