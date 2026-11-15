import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Abre a página da SEFAZ num navegador invisível (WebView) e devolve o HTML.
 *
 * Plano B para portais com verificação anti-robô (como o de SP): um `fetch` simples
 * recebe só a página de verificação, mas o WebView executa o JavaScript dela como
 * um navegador de verdade e chega à página com os itens.
 */
export function PaginaSefazOculta({
  url,
  aoReceberHtml,
  aoFalhar,
  limiteSegundos = 30,
}: {
  url: string;
  aoReceberHtml: (html: string) => void;
  aoFalhar: (erro: Error) => void;
  limiteSegundos?: number;
}) {
  const terminou = useRef(false);

  function concluir(acao: () => void) {
    if (terminou.current) return;
    terminou.current = true;
    acao();
  }

  useEffect(() => {
    const t = setTimeout(
      () => concluir(() => aoFalhar(new Error('A SEFAZ demorou demais para responder. Tente de novo.'))),
      limiteSegundos * 1000,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <WebView
      style={estilos.oculta}
      source={{ uri: url }}
      injectedJavaScript={SCRIPT_ESPERA_ITENS}
      onMessage={(e: WebViewMessageEvent) => concluir(() => aoReceberHtml(e.nativeEvent.data))}
      onError={(e) => concluir(() => aoFalhar(new Error(`Não foi possível abrir a SEFAZ: ${e.nativeEvent.description}`)))}
      onHttpError={(e) => concluir(() => aoFalhar(new Error(`SEFAZ respondeu ${e.nativeEvent.statusCode}`)))}
    />
  );
}

/**
 * Roda dentro da página: espera a tabela de itens aparecer (até ~20 s) e manda o HTML.
 * Se a página de verificação recarregar, o script roda de novo na página nova.
 */
const SCRIPT_ESPERA_ITENS = `
(function () {
  var tentativas = 0;
  function enviar() { window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); }
  function verificar() {
    tentativas++;
    if (document.querySelector('#tabResult tr')) { enviar(); return; }
    if (tentativas >= 40) { enviar(); return; }
    setTimeout(verificar, 500);
  }
  verificar();
})();
true;
`;

const estilos = StyleSheet.create({
  // Invisível, mas com tamanho: alguns Androids não carregam WebView de tamanho zero.
  oculta: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
