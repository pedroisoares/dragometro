# Metodologia

O Dragômetro segue a lógica do IBGE para o IPCA e o INPC, aplicada à cesta de compras de uma pessoa ou família.

## 1. Preço comparável

Cada item do cupom vira um **preço por unidade base** (R$/kg, R$/L ou R$/un):

- vendido por peso/volume (KG, L): o valor unitário já está na unidade base;
- vendido por unidade, com o tamanho na descrição ("LEITE UHT 1L", "CAFE 500G", "AGUA 6X1,5L"): divide-se pelo tamanho;
- sem tamanho identificável: preço por unidade.

Código: `packages/core/src/unidades.ts`.

## 2. Preço do produto no período: média geométrica (Jevons)

Se o mesmo produto foi comprado várias vezes num período, o preço do período é a **média geométrica** das compras. É o que o IBGE faz ao juntar os preços coletados de um mesmo subitem:

```
p(produto, período) = (p₁ × p₂ × … × pₙ)^(1/n)
```

Exemplo: leite a 5,69, 3,79 e 4,80 no mesmo mês → R$ 4,70.

## 3. Variação de um produto

```
variação = p(t) / p(t−1) − 1
acumulado = p(t) / p(primeiro) − 1 = Π (1 + variaçãoₖ) − 1
```

As variações podem ser vistas por semana (ISO, começando na segunda-feira), mês ou ano. **A comparação com o IBGE é sempre mensal**, porque não existe índice oficial semanal.

## 4. Índice pessoal: Laspeyres modificado

Os pesos iniciais `w` são a participação de cada produto (ou categoria) no gasto de um período-base, por exemplo os 3 primeiros meses de cupons. A cada mês:

```
I(t) = Σ wᵢ(t−1) × pᵢ(t) / pᵢ(t−1)
wᵢ(t) = wᵢ(t−1) × [pᵢ(t) / pᵢ(t−1)] / I(t)
```

- `I(t) − 1` é a inflação pessoal do mês; os meses se acumulam por multiplicação.
- A atualização dos pesos reflete que, com a quantidade fixa, o produto que encareceu passa a pesar mais no orçamento. É o mesmo procedimento mensal do IBGE.
- **Produto não comprado no mês:** fica fora do cálculo naquele mês, e os pesos dos demais são reescalados. Isso equivale a imputar para ele a variação média do mês. O IBGE faz uma imputação parecida, mas dentro de cada grupo.

Código: `indicePessoal` em `packages/core/src/indice.ts`.

### 4.1 Por categoria do IBGE (o que o app usa)

Cada item do cupom é encaixado num **subitem do IPCA** (ver seção 6). O cálculo segue então a mesma estrutura do IBGE:

1. **Dentro do subitem:** os relativos de preço dos produtos comprados nos dois meses são juntados por **média geométrica** (Jevons). Assim, o leite da loja A e o leite da loja B entram juntos em "Leite longa vida", mesmo sendo produtos diferentes.
2. **Entre subitens:** Laspeyres modificado, como acima, com pesos pela participação de cada subitem no gasto.

Itens sem classificação não somem: cada um vira uma categoria sozinho.

Os pesos usam o gasto de **todos os cupons guardados**, que fazem para você o papel que a POF faz para o IPCA. Com o tempo, o certo é fixar um período-base, como o IBGE faz.

Código: `indicePorCategoria` em `packages/core/src/indice.ts`.

### Inflação não é variação do gasto

Se o seu gasto subiu 20% porque você comprou mais, isso não é inflação. O índice mede **só preço**, com a cesta fixa. O app mostra os dois números separados.

## 5. Comparação com o IBGE

| Série | Tabela SIDRA | Variável |
|---|---|---|
| IPCA, índice geral | 1737 | 63 (variação mensal) |
| INPC, índice geral | 1736 | 44 (variação mensal) |
| IPCA por subitem | 7060 | 63 (variação), 66 (peso) |
| INPC por subitem | 7063 | 44 (variação), 45 (peso) |

As tabelas de subitem usam a classificação 315 e começam em janeiro de 2020, quando entraram os pesos da POF 2017-2018.

**Qual índice comparar?**

- **IPCA:** famílias com renda de 1 a 40 salários mínimos. É a inflação oficial.
- **INPC:** famílias com renda de 1 a 5 salários mínimos. Alimentação pesa mais. Usado para corrigir o salário mínimo e benefícios do INSS.

**Limite importante:** os cupons de supermercado cobrem bem "alimentação no domicílio", mas não aluguel, energia, combustível, saúde ou educação. Enquanto essas despesas não forem lançadas no app, compare a sua inflação com o grupo **"11. Alimentação no domicílio"** do IPCA, e não com o índice geral.

## 6. Classificação nos subitens do IPCA

As descrições dos cupons vêm abreviadas ("QJ M FRESC BANDEIRA PT KG", "CR DEN COLGATE"). O pacote `packages/classificacao` faz o encaixe assim:

1. **Normaliza a descrição:** maiúsculas, sem acentos, pontuação vira espaço.
2. **Aplica regras em ordem** (`src/regras.ts`); a primeira que casar define o subitem. As regras mais específicas vêm antes: "biscoito de chocolate" é biscoito, não chocolate, e "creme dental" é higiene, não creme de leite.
3. **Usa o catálogo oficial:** os códigos e nomes vêm da tabela 7060 do SIDRA (`dados/catalogo-ipca.txt`). Nesse catálogo estão alimentação no domicílio, artigos de limpeza e higiene pessoal.

Alguns produtos não têm subitem no IPCA (creme de leite, batata palha) e ficam como "Sem categoria". Nos cupons reais de teste, 33 de 35 itens foram classificados.

A comparação de um produto com o IPCA é feita com o subitem dele: o seu arroz contra o "Arroz" do IPCA. O IBGE divulga o IPCA de cada mês por volta do dia 10 do mês seguinte.

## 7. O que é "o mesmo produto" e como as correções entram nas contas

Todas as contas acima (média geométrica no período, variação, pesos, índice por categoria) usam dois dados de cada item comprado:

- **o produto** (`produto_id`), que diz quais compras são do mesmo produto e por isso podem ter o preço comparado;
- **o subitem do IPCA** (`subitem`), que diz em que categoria o produto entra.

O nome da loja e a descrição exibida não entram nas contas. As contas são feitas na hora, a partir dos itens guardados. Assim, qualquer correção vale imediatamente para variações e índices, sem recálculo à parte.

**Como o produto é definido:**

| Origem do cupom | Produto |
|---|---|
| SEFAZ (QR Code ou chave) | loja (CNPJ) + código do produto no cupom |
| Foto (sem chave) | loja + descrição; uma descrição igual ou parecida (≥ 85%, ignorando espaços e acentos) com a de um produto já comprado na mesma loja vira o mesmo produto |

**Correções e o efeito nas contas:**

- **Corrigir a descrição de um item:** o subitem do IPCA é recalculado.
  - Item da foto: os produtos da loja são reagrupados, do cupom mais antigo para o mais recente. Assim o item corrigido entra junto com as outras compras do mesmo produto, ou sai do grupo se a correção mostrar que era outro produto. Dá para aplicar a correção a todas as compras do produto de uma vez.
  - Item da SEFAZ: o código manda, então a descrição muda em todas as compras daquele produto e o produto não muda.
- **Corrigir quantidade, unidade, valor unitário ou valor total de um item:** vale só para aquele item.
  - Quantidade, unidade e valor unitário formam o preço comparável (R$/kg, R$/L ou R$/un), usado na variação de preço e na média geométrica.
  - O valor total é o gasto, que pesa a categoria no índice pessoal.
  - A tela confere se quantidade × valor unitário = total. Se não bater (por exemplo, por desconto), avisa e oferece corrigir o total ou calcular o valor unitário, mas deixa salvar assim mesmo.
  - Quantidade fracionada com unidade UN é quase sempre peso: a revisão da foto troca para KG sozinha, e a edição avisa.
- **Corrigir o nome da loja:** só muda o que aparece na tela, sem efeito nas contas.
- **Juntar lojas:** quando o OCR leu o nome tão diferente que a mesma loja foi guardada duas vezes, os produtos ficam divididos e a variação de preço se perde. Ao corrigir o nome, o app avisa se já existe uma loja com nome parecido e oferece juntar as duas. Depois de juntar, os produtos são reagrupados. Duas lojas com CNPJ nunca se juntam, porque cada filial tem seus próprios preços.

## Referências

- IBGE, *Sistema Nacional de Índices de Preços ao Consumidor: métodos de cálculo* (Série Relatórios Metodológicos).
- IBGE, notas técnicas de atualização das estruturas de ponderação (POF 2017-2018).
- API SIDRA: https://apisidra.ibge.gov.br
