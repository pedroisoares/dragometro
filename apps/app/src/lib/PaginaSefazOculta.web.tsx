/**
 * Na Web não usamos WebView: a consulta à SEFAZ passa pela API (veja lib/consulta.ts).
 * Este arquivo existe para o empacotador Web não incluir o react-native-webview.
 */
export function PaginaSefazOculta(_props: {
  url: string;
  aoReceberHtml: (html: string) => void;
  aoFalhar: (erro: Error) => void;
  limiteSegundos?: number;
}) {
  return null;
}
