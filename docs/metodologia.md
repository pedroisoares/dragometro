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

## Referências

- IBGE, *Sistema Nacional de Índices de Preços ao Consumidor: métodos de cálculo* (Série Relatórios Metodológicos).
- IBGE, notas técnicas de atualização das estruturas de ponderação (POF 2017-2018).
- API SIDRA: https://apisidra.ibge.gov.br
