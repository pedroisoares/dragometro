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
- [x] Leitor da página da SEFAZ no layout mais comum, **validado com cupons reais de SP**
- [x] Cliente da API SIDRA do IBGE (IPCA, INPC e subitens)
- [x] App (iOS, Android e Web) com leitura do QR Code (ou colando o link)
- [x] Compras guardadas no aparelho (SQLite), com telas de cupons, produtos e variação de preço por semana/mês/ano
- [x] Produtos classificados nos subitens do IPCA, comparação de cada produto com o IPCA e tela "Minha inflação" (índice pessoal x IPCA e gastos por categoria)
- [x] API com ponte para a SEFAZ (para a Web) e índices do IBGE

Próximos passos:

- [ ] Validar o leitor com cupons reais dos outros estados ([ajude com o seu!](CONTRIBUTING.md))
- [ ] Confirmar em celulares reais o plano B por WebView para a proteção anti-robô do portal da SEFAZ-SP
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
  classificacao/  encaixa itens do cupom nos subitens do IPCA
  armazenamento/  banco local SQLite (expo-sqlite no app, node:sqlite nos testes)
docs/        metodologia e decisões
```

Tudo é TypeScript. Os leitores da SEFAZ ficam num pacote próprio porque o mesmo código roda no celular e na API.

## Instalando e testando

O passo a passo completo, para quem vai usar e para quem vai contribuir, está em **[docs/instalacao.md](docs/instalacao.md)**.

Resumo para quem já tem Node 22 e pnpm 10:

```bash
git clone https://github.com/pedroisoares/dragometro.git
cd dragometro
pnpm install

# Celular (Expo Go): um terminal
pnpm app

# Computador (navegador): dois terminais
cp apps/app/.env.example apps/app/.env   # uma vez só
pnpm api     # terminal 1
pnpm web     # terminal 2 → http://localhost:8081
```

## Contribuindo

Contribuições são muito bem-vindas, principalmente **leitores das SEFAZ de outros estados**. Veja o [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacidade

Cupons fiscais mostram onde, quando e o que você compra. Por isso o Dragômetro foi pensado para:

- consultar a SEFAZ a partir do próprio aparelho sempre que possível;
- guardar os dados no aparelho (SQLite). Um ano de compras, com 2 cupons por semana, ocupa cerca de 450 KB;
- permitir que qualquer pessoa rode a própria instância da API.

Nunca inclua cupons com CPF ou dados pessoais em issues, PRs ou arquivos de teste.

## Licença

[AGPL-3.0](LICENSE). Você pode usar, modificar e hospedar o Dragômetro. Se oferecer uma versão modificada como serviço, precisa publicar o código.

O Dragômetro não tem relação com o IBGE nem com as Secretarias da Fazenda. Os índices oficiais vêm da API pública SIDRA do IBGE.
