# Como contribuir

Obrigado por ajudar a domar o dragão! 🐉

## Antes de começar

```bash
pnpm install
pnpm test
pnpm typecheck
```

Abra um PR pequeno e focado. Escreva os testes junto com o código. Os textos do app e dos comentários são em português.

## A contribuição mais valiosa: o leitor da SEFAZ do seu estado

Cada estado tem a própria página de consulta da NFC-e. Hoje existe um leitor genérico (`packages/sefaz/src/leitores/layout-padrao.ts`), já **validado com cupons reais de SP**. Os outros estados podem usar o mesmo layout ou não; só testando para saber.

### 1. Salve uma página real

1. Leia o QR Code de um cupom seu com a câmera do celular e abra o link no computador. Ou digite a chave de 44 dígitos no portal de consulta da SEFAZ do seu estado.
2. Salve a página: **Ctrl+S → "Página da Web, somente HTML"**.
3. **Remova os dados pessoais.** Se o cupom tiver CPF, nome ou endereço do consumidor, apague ou troque por `000.000.000-00`. Também vale trocar os últimos dígitos da chave de acesso. Os testes não precisam de uma chave real; o `calcularDV` gera o dígito verificador.
4. Coloque o arquivo em `packages/sefaz/test/fixtures/<uf>.html` (ex.: `pr.html`).

### 2. Teste o leitor genérico

Escreva um teste em `packages/sefaz/test/<uf>.test.ts` usando `lerNotaDaPagina(html, chave)` e confira itens, quantidades e valores com o papel do cupom.

- **Funcionou?** Em `layout-padrao.ts`, adicione a UF à lista `ufs` (a lista de estados já validados). Pronto!
- **Não funcionou?** Crie `packages/sefaz/src/leitores/<uf>.ts` exportando um `LeitorSefaz` e registre-o em `packages/sefaz/src/leitores/index.ts`.

### 3. Abra o PR

Conte no PR o estado, o mês do cupom e se o portal tinha alguma particularidade (captcha, página carregada por JavaScript, iframe...).

## Ensinar o app a reconhecer produtos

Quando um produto aparece como "Sem categoria", dá para ensinar o app em dois passos:

1. Em `packages/classificacao/src/regras.ts`, acrescente uma regra perto das parecidas. Ela diz o código do subitem do IPCA e um padrão para a descrição normalizada (maiúsculas, sem acentos). Os códigos estão em `packages/classificacao/dados/catalogo-ipca.txt`.
2. Em `packages/classificacao/test/classificacao.test.ts`, acrescente a descrição como aparece no cupom e o subitem esperado.

Lembre que a primeira regra que casar vence: coloque a sua antes de regras mais genéricas que possam capturar a descrição.

## Outras formas de ajudar

- **Metodologia:** revise `docs/metodologia.md` e o pacote `core`. Economistas e estatísticos são muito bem-vindos.
- **App:** telas, acessibilidade, design.

## Regras de convivência

Seja gentil. Discorde de ideias, não de pessoas.
