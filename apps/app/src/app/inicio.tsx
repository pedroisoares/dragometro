import { Redirect } from 'expo-router';

/**
 * Porta de entrada da versão Web. O servidor de desenvolvimento do Expo não envia os
 * cabeçalhos COOP/COEP na raiz "/", e sem eles o banco local não abre no navegador.
 * O `public/index.html` manda a raiz para cá (com cabeçalhos) e daqui voltamos para "/"
 * sem recarregar a página, mantendo o isolamento.
 */
export default function Inicio() {
  return <Redirect href="/" />;
}
