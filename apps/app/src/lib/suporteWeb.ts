import { Platform } from 'react-native';

export type ProblemaWeb = 'endereco-inseguro' | 'sem-isolamento' | 'navegador';

/**
 * Na Web, o banco local (expo-sqlite) só funciona se a página estiver num contexto seguro
 * (https ou localhost), com isolamento de origem (cabeçalhos COOP/COEP) e com acesso ao
 * armazenamento do navegador. Retorna o motivo quando algo falta; `null` se está tudo certo.
 */
export function problemaNaWeb(): ProblemaWeb | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as typeof globalThis & {
    isSecureContext?: boolean;
    crossOriginIsolated?: boolean;
    navigator?: { storage?: { getDirectory?: unknown } };
  };
  if (!g.isSecureContext) return 'endereco-inseguro';
  if (!g.crossOriginIsolated) return 'sem-isolamento';
  if (typeof g.navigator?.storage?.getDirectory !== 'function') return 'navegador';
  return null;
}

export const EXPLICACAO: Record<ProblemaWeb, { titulo: string; texto: string }> = {
  'endereco-inseguro': {
    titulo: 'Abra pelo endereço localhost',
    texto:
      'A versão Web só consegue guardar os seus cupons quando é aberta no próprio computador, ' +
      'pelo endereço http://localhost:8081, ou por um endereço https.\n\n' +
      'Para testar no celular, use o app Expo Go e leia o QR Code que aparece no terminal.',
  },
  'sem-isolamento': {
    titulo: 'Servidor sem os cabeçalhos necessários',
    texto:
      'O servidor precisa enviar os cabeçalhos Cross-Origin-Opener-Policy: same-origin e ' +
      'Cross-Origin-Embedder-Policy: credentialless. Com `pnpm web` isso já é feito; ' +
      'ao publicar o site, configure o servidor para enviá-los.',
  },
  navegador: {
    titulo: 'Navegador sem suporte',
    texto: 'Este navegador não permite guardar dados localmente. Use uma versão recente do Chrome, Edge, Firefox ou Safari.',
  },
};
