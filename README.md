# 🐉 Dragômetro

**Meça o seu dragão.** O Dragômetro calcula a sua **inflação pessoal** a partir dos seus cupons fiscais e compara com a inflação oficial (**IPCA** e **INPC** do IBGE), usando a mesma metodologia do IBGE.

> O "dragão da inflação" é como o Brasil chama a inflação desde os anos 80. Cada pessoa tem o seu: quem gasta mais com remédio, aluguel ou comida sente uma inflação diferente da média do país.

## Como funciona

1. **Você lê o QR Code do cupom fiscal** (NFC-e) com o celular.
2. **O app busca os itens na SEFAZ do seu estado**: descrição, quantidade, unidade e preço. No celular, a consulta sai direto do aparelho. O cupom não passa pelo nosso servidor.
3. **Os preços são normalizados** (R$/kg, R$/L), para comparar embalagens diferentes do mesmo produto.
4. **O Dragômetro calcula**:
   - quanto cada produto subiu ou caiu por semana, mês e ano;
   - o seu índice de inflação pessoal, com os pesos dos seus próprios gastos;
   - a comparação com o IPCA, o INPC e o subitem equivalente do IBGE (o seu leite contra o "Leite longa vida" do IPCA).

A explicação completa das fórmulas está em [`docs/metodologia.md`](docs/metodologia.md).

## Situação

🚧 **Início do projeto.** O que já existe:

- [x] Cálculo do índice (Jevons + Laspeyres modificado), com testes
- [x] Leitura da chave de acesso e do QR Code da NFC-e
- [x] Leitor da página da SEFAZ no layout mais comum (**ainda não validado com páginas reais**)
- [x] Cliente da API SIDRA do IBGE (IPCA, INPC e subitens)
- [x] App (iOS, Android e Web) com leitura do QR Code
- [x] API com ponte para a SEFAZ (para a Web) e índices do IBGE

Próximos passos:

- [ ] Validar o leitor com cupons reais de cada estado ([ajude com o seu!](CONTRIBUTING.md))
- [ ] Guardar as compras no aparelho (SQLite)
- [ ] Classificar produtos nos subitens do IPCA
- [ ] Telas de evolução por produto e de comparação com o IPCA/INPC
- [ ] Plano B por OCR para cupons sem QR Code legível
- [ ] Bot no Telegram para enviar a foto do cupom

## Estrutura

```
apps/
  app/       Expo + Expo Router → iOS, Android e Web
  api/       Fastify: ponte com a SEFAZ para a Web e índices do IBGE
packages/
  core/      modelos, normalização de unidades e cálculo do índice
  sefaz/     chave de acesso, QR Code e leitores das páginas das SEFAZ
  ibge/      cliente da API SIDRA (IPCA, INPC, subitens)
docs/        metodologia e decisões
```

Tudo é TypeScript. Os leitores da SEFAZ ficam num pacote próprio porque o mesmo código roda no celular e na API.

## Rodando

Requisitos: Node 22+ e pnpm 10+.

```bash
pnpm install
pnpm test          # testes de todos os pacotes
pnpm typecheck     # checagem de tipos

pnpm app           # inicia o app (Expo). Use o Expo Go no celular ou pressione "w" para Web
pnpm api           # inicia a API em http://localhost:3333
```

Para a versão Web consultar a SEFAZ, copie `apps/app/.env.example` para `apps/app/.env` e deixe a API rodando.

## Contribuindo

Contribuições são muito bem-vindas, principalmente **leitores das SEFAZ de outros estados**. Veja o [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacidade

Cupons fiscais mostram onde, quando e o que você compra. Por isso o Dragômetro foi pensado para:

- consultar a SEFAZ a partir do próprio aparelho sempre que possível;
- guardar os dados no aparelho, com sincronização opcional;
- permitir que qualquer pessoa rode a própria instância da API.

Nunca inclua cupons com CPF ou dados pessoais em issues, PRs ou arquivos de teste.

## Licença

[AGPL-3.0](LICENSE). Você pode usar, modificar e hospedar o Dragômetro. Se oferecer uma versão modificada como serviço, precisa publicar o código.

O Dragômetro não tem relação com o IBGE nem com as Secretarias da Fazenda. Os índices oficiais vêm da API pública SIDRA do IBGE.
