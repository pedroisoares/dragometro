import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import sharp, { type Sharp } from 'sharp';
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

/**
 * Largura do papel recortado em que o OCR trabalha. Como cupons têm ~40 a 48 caracteres
 * por linha, deixar o papel sempre na mesma largura deixa as letras sempre do mesmo
 * tamanho (~35 px), seja a foto do WhatsApp (pequena) ou da câmera (12 megapixels).
 */
const LARGURA_PAPEL = 1700;
/** Raio da "média da vizinhança" usada para uniformizar a luz, na escala acima. */
const SIGMA_LUZ = 24;
/** Fotos maiores que isso são reduzidas logo no início (só para ganhar tempo). */
const LARGURA_ENTRADA = 2400;

type Cinza = { px: Buffer; largura: number; altura: number };

async function cinzaDe(entrada: Sharp): Promise<Cinza> {
  const { data, info } = await entrada.removeAlpha().grayscale().extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return { px: data, largura: info.width, altura: info.height };
}

const sharpDe = (c: Cinza) => sharp(c.px, { raw: { width: c.largura, height: c.altura, channels: 1 } });

/**
 * Prepara a foto para o OCR:
 * 1. gira conforme a orientação gravada pela câmera (EXIF) e passa para tons de cinza;
 * 2. acha o papel (a parte clara) e mede a inclinação das linhas de texto; se a foto
 *    estiver torta, endireita;
 * 3. recorta só o papel, tirando a mesa em volta, que vira "texto" lixo;
 * 4. deixa o papel sempre com a mesma largura (amplia foto pequena, reduz foto grande);
 * 5. uniformiza a iluminação: divide cada ponto pela média da vizinhança. Sombra e
 *    papel térmico desbotado deixam de atrapalhar.
 */
export async function prepararImagem(imagem: Buffer): Promise<Buffer> {
  let base = sharp(imagem).rotate();
  const { width = 0 } = await sharp(imagem).metadata();
  if (width > LARGURA_ENTRADA) base = base.resize({ width: LARGURA_ENTRADA });
  let img = await cinzaDe(base);

  const angulo = await inclinacao(img, recortePapel(img.px, img.largura, img.altura));
  if (Math.abs(angulo) >= 0.3) {
    // Fundo preto nos cantos: continua sendo "mesa" para o recorte do papel.
    img = await cinzaDe(sharpDe(img).rotate(-angulo, { background: '#000000' }));
  }
  const recorte = recortePapel(img.px, img.largura, img.altura);

  const papel = await cinzaDe(sharpDe(img).extract(recorte).resize({ width: LARGURA_PAPEL, kernel: 'lanczos3' }));
  const fundo = await cinzaDe(sharpDe(papel).blur(SIGMA_LUZ));
  const saida = Buffer.alloc(papel.px.length);
  for (let i = 0; i < saida.length; i++) saida[i] = Math.min(255, Math.round((papel.px[i]! / Math.max(1, fundo.px[i]!)) * 255));

  return sharpDe({ ...papel, px: saida }).png().toBuffer();
}

/**
 * Inclinação do texto, em graus (positivo = linhas descendo para a direita).
 * Numa versão pequena do papel, marca os pontos de tinta e testa ângulos de -8° a 8°:
 * no ângulo certo, a tinta se concentra em faixas horizontais (as linhas do cupom).
 */
async function inclinacao(img: Cinza, recorte: { left: number; top: number; width: number; height: number }): Promise<number> {
  const pequeno = await cinzaDe(sharpDe(img).extract(recorte).resize({ width: 600 }));
  const media = await cinzaDe(sharpDe(pequeno).blur(8));
  const tinta: [number, number][] = [];
  for (let y = 0; y < pequeno.altura; y++) {
    for (let x = 0; x < pequeno.largura; x++) {
      const i = y * pequeno.largura + x;
      if (pequeno.px[i]! < 0.8 * media.px[i]!) tinta.push([x, y]);
    }
  }
  if (tinta.length < 500) return 0;
  let melhor = 0;
  let nota = -1;
  for (let a = -8; a <= 8.001; a += 0.25) {
    const t = Math.tan((a * Math.PI) / 180);
    const faixas = new Map<number, number>();
    for (const [x, y] of tinta) {
      const f = Math.round(y - x * t);
      faixas.set(f, (faixas.get(f) ?? 0) + 1);
    }
    let soma = 0;
    for (const n of faixas.values()) soma += n * n;
    if (soma > nota) {
      nota = soma;
      melhor = a;
    }
  }
  return melhor;
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
