import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Abre a página de consulta da SEFAZ pela chave de acesso, VISÍVEL, para a pessoa
 * resolver o captcha. O app só preenche a chave e espera a página com os itens
 * aparecer; quem confirma e digita o captcha é a pessoa.
 */
export function PaginaSefazVisivel({
  url,
  chave,
  aoReceberHtml,
  aoFalhar,
}: {
  url: string;
  chave: string;
  aoReceberHtml: (html: string) => void;
  aoFalhar: (erro: Error) => void;
}) {
  const terminou = useRef(false);
  const concluir = (acao: () => void) => {
    if (terminou.current) return;
    terminou.current = true;
    acao();
  };

  return (
    <WebView
      style={estilos.pagina}
      source={{ uri: url }}
      injectedJavaScript={scriptPreencherEEsperar(chave)}
      onMessage={(e: WebViewMessageEvent) => concluir(() => aoReceberHtml(e.nativeEvent.data))}
      onError={(e) => concluir(() => aoFalhar(new Error(`Não foi possível abrir a SEFAZ: ${e.nativeEvent.description}`)))}
    />
  );
}

/**
 * Roda dentro da página da SEFAZ: preenche o campo da chave (qualquer campo cujo nome
 * ou id tenha "chave") e, quando a página com a tabela de itens aparecer (depois que a
 * pessoa resolver o captcha e consultar), manda o HTML para o app.
 */
function scriptPreencherEEsperar(chave: string): string {
  return `
(function () {
  var CHAVE = ${JSON.stringify(chave)};
  function preencher() {
    var campos = document.querySelectorAll('input[type=text], input:not([type])');
    for (var i = 0; i < campos.length; i++) {
      var c = campos[i];
      if (/chave/i.test((c.name || '') + ' ' + (c.id || '')) && !c.value) {
        c.value = CHAVE;
        c.dispatchEvent(new Event('input', { bubbles: true }));
        c.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
  function verificar() {
    if (document.querySelector('#tabResult tr')) {
      window.ReactNativeWebView.postMessage(document.documentElement.outerHTML);
      return;
    }
    preencher();
    setTimeout(verificar, 700);
  }
  verificar();
})();
true;
`;
}

const estilos = StyleSheet.create({
  pagina: { flex: 1 },
});
