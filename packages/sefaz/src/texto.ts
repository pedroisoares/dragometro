import { chaveValida, lerChave } from './chave';
import type { ChaveAcesso, UF } from './tipos';

/**
 * Leitura da chave de acesso a partir de TEXTO, por exemplo o resultado de um OCR
 * da foto do cupom. Funciona com qualquer motor de OCR (na API hoje, no celular depois),
 * porque só recebe o texto reconhecido.
 */

/** Letras que o OCR costuma trocar por dígitos em sequências numéricas. */
const CONFUSOES: Record<string, string> = {
  O: '0', o: '0', Q: '0', D: '0', U: '0',
  I: '1', l: '1', i: '1', '|': '1', '!': '1', L: '1',
  Z: '2', z: '2',
  S: '5', s: '5',
  G: '6', b: '6',
  T: '7',
  B: '8',
  g: '9', q: '9',
};

/**
 * Transforma o texto em "trechos numéricos". O texto é dividido em palavras; uma palavra
 * conta como número se, trocando as letras confundíveis, só sobrarem dígitos (pontos e
 * hífens são ignorados) e ela tiver ao menos um dígito de verdade ou até 4 caracteres
 * (um grupo da chave lido todo como letras, ex.: "OOOO"). Palavras numéricas seguidas,
 * inclusive em linhas diferentes, formam um trecho; qualquer outra palavra encerra o trecho.
 */
function trechosNumericos(texto: string): string[] {
  const trechos: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    const limpa = palavra.replace(/[.\-_]/g, '');
    const convertida = [...limpa].map((c) => (/\d/.test(c) ? c : (CONFUSOES[c] ?? 'x'))).join('');
    const ehNumero = limpa.length > 0 && !convertida.includes('x') && (/\d/.test(limpa) || limpa.length <= 4);
    if (ehNumero) {
      atual += convertida;
    } else {
      if (atual) trechos.push(atual);
      atual = '';
    }
  }
  if (atual) trechos.push(atual);
  return trechos;
}

/**
 * Quando nenhuma chave válida aparece (um dígito lido errado, por exemplo), devolve a
 * sequência de dígitos mais parecida com uma chave, para a pessoa só corrigir o que faltar.
 * Retorna `undefined` se não houver nada parecido (menos de 30 dígitos seguidos).
 */
export function digitosProvaveisDaChave(texto: string): string | undefined {
  const melhor = trechosNumericos(texto)
    .filter((t) => t.length >= 30)
    .sort((a, b) => Math.abs(a.length - 44) - Math.abs(b.length - 44))[0];
  return melhor?.slice(0, 44);
}

/** Ano e mês plausíveis, e modelo de nota fiscal (55 = NF-e, 65 = NFC-e). */
function plausivel(chave: string): boolean {
  const ano = Number(chave.slice(2, 4));
  const mes = Number(chave.slice(4, 6));
  const modelo = chave.slice(20, 22);
  return ano >= 12 && mes >= 1 && mes <= 12 && (modelo === '65' || modelo === '55');
}

/**
 * Chaves de acesso válidas encontradas no texto, da mais provável para a menos.
 * Valida dígito verificador, UF, ano/mês e modelo, o que torna quase impossível
 * aceitar uma sequência errada do OCR.
 */
export function chavesNoTexto(texto: string): ChaveAcesso[] {
  const encontradas = new Map<string, number>(); // chave → pontuação
  for (const trecho of trechosNumericos(texto)) {
    if (trecho.length < 44) continue;
    for (let i = 0; i + 44 <= trecho.length; i++) {
      const candidata = trecho.slice(i, i + 44);
      if (!chaveValida(candidata) || !plausivel(candidata)) continue;
      // Trecho com exatamente 44 dígitos é o caso ideal.
      const pontos = trecho.length === 44 ? 2 : 1;
      encontradas.set(candidata, Math.max(encontradas.get(candidata) ?? 0, pontos));
    }
  }
  return [...encontradas]
    .sort(([, a], [, b]) => b - a)
    .map(([chave]) => lerChave(chave));
}

/**
 * Página de consulta pela chave de acesso de cada estado. A consulta pela chave pede
 * um captcha, que a pessoa resolve no app. Acrescente o seu estado quando testar.
 */
export const URL_CONSULTA_POR_CHAVE: Partial<Record<UF, string>> = {
  SP: 'https://www.nfce.fazenda.sp.gov.br/consulta',
};

/**
 * O cupom costuma trazer impresso "Consulte pela Chave de Acesso em <endereço>".
 * Quando o OCR lê esse endereço, ele vale mais que a tabela acima.
 */
export function urlConsultaNoTexto(texto: string): string | undefined {
  const m = /((?:https?:\/\/)?(?:www\.)?[a-z0-9.-]*(?:fazenda|sefaz|sef|nfce)[a-z0-9.-]*\.gov\.br\/[^\s]*)/i.exec(
    // O OCR costuma separar os pontos: "www. nfce. fazenda .sp.gov.br"
    texto.replace(/\s*\.\s*/g, '.'),
  );
  if (!m?.[1]) return undefined;
  const url = m[1].replace(/[),;]+$/, '').replace(/^https?:\/\//i, '');
  // Domínio não diferencia maiúsculas (o OCR às vezes lê "Www"); o caminho fica como está.
  const barra = url.indexOf('/');
  return `https://${url.slice(0, barra).toLowerCase()}${url.slice(barra)}`;
}

/** Endereço para consultar a nota pela chave: o impresso no cupom ou o conhecido do estado. */
export function urlConsultaPorChave(chave: ChaveAcesso, textoDoCupom = ''): string | undefined {
  return urlConsultaNoTexto(textoDoCupom) ?? URL_CONSULTA_POR_CHAVE[chave.uf];
}

/**
 * O texto da foto tem sinais de que o cupom TEM chave de acesso, mesmo que ela não tenha
 * sido lida? ("Chave de acesso", "NFC-e", "CF-e SAT", "Consulte pela chave", "Protocolo de
 * autorização" ou uma sequência longa de números.) Serve para orientar a pessoa entre
 * "digite a chave" e "este cupom não tem chave".
 */
export function indiciosDeChave(texto: string): boolean {
  const palavras =
    /CHAVE\s*DE\s*ACESSO|NFC[\s-]?E\b|CF[\s-]?E\b|\bDANFE|CONSULTE\s+PELA|PROTOCOLO\s+DE\s+AUTORIZA|\bSAT\s*N/i;
  return palavras.test(texto) || (digitosProvaveisDaChave(texto)?.length ?? 0) >= 30;
}
