import type { ChaveAcesso, UF } from './tipos';

export const UF_POR_CODIGO: Record<string, UF> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

/**
 * Dígito verificador da chave (módulo 11): pesos de 2 a 9 da direita para a esquerda
 * sobre os 43 primeiros dígitos; resto 0 ou 1 → DV 0.
 */
export function calcularDV(chave43: string): number {
  if (!/^\d{43}$/.test(chave43)) throw new Error('Esperados 43 dígitos');
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Remove espaços e pontos e confere tamanho e dígito verificador. Útil para validar OCR. */
export function chaveValida(texto: string): boolean {
  const chave = texto.replace(/\D/g, '');
  if (chave.length !== 44) return false;
  if (!UF_POR_CODIGO[chave.slice(0, 2)]) return false;
  return calcularDV(chave.slice(0, 43)) === Number(chave[43]);
}

/** Separa os campos da chave de acesso. Lança erro se a chave for inválida. */
export function lerChave(texto: string): ChaveAcesso {
  const chave = texto.replace(/\D/g, '');
  if (!chaveValida(chave)) throw new Error(`Chave de acesso inválida: ${texto}`);
  const codigoUF = chave.slice(0, 2);
  return {
    chave,
    codigoUF,
    uf: UF_POR_CODIGO[codigoUF]!,
    anoMes: `20${chave.slice(2, 4)}-${chave.slice(4, 6)}`,
    cnpjEmitente: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: chave.slice(22, 25),
    numero: chave.slice(25, 34),
    tipoEmissao: chave.slice(34, 35),
    codigoNumerico: chave.slice(35, 43),
    digitoVerificador: chave.slice(43, 44),
  };
}

/**
 * Extrai a chave de acesso do conteúdo do QR Code da NFC-e.
 * Funciona com as versões do QR que usam `?p=CHAVE|...` e com a antiga `?chNFe=CHAVE&...`.
 */
export function chaveDoQrCode(conteudo: string): ChaveAcesso {
  for (const candidata of conteudo.match(/\d{44}/g) ?? []) {
    if (chaveValida(candidata)) return lerChave(candidata);
  }
  throw new Error('Nenhuma chave de acesso válida encontrada no QR Code');
}
