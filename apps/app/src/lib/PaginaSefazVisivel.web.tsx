/**
 * Na Web não dá para ler a página da SEFAZ aberta pelo usuário (outro site, com captcha).
 * A tela de chave mostra, em vez disso, o botão para abrir a consulta numa nova aba.
 */
export function PaginaSefazVisivel(_props: {
  url: string;
  chave: string;
  aoReceberHtml: (html: string) => void;
  aoFalhar: (erro: Error) => void;
}) {
  return null;
}
