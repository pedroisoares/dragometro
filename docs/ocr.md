# OCR: como a foto do cupom vira dados

Pela tela **Ler cupom → "Cupom sem QR Code? Use a foto do cupom"**, uma foto do cupom inteiro serve para os dois casos. Se o texto tiver a chave de acesso, segue a etapa 1. Se não tiver, segue a etapa 2.

## Etapa 1: foto da chave de acesso

```
foto ──► motor de OCR ──► texto ──► chavesNoTexto() ──► chave válida? ──► consulta na SEFAZ
         (API: Tesseract)           (pacote sefaz)       (dígito verificador)  (captcha pela pessoa)
```

1. **Foto:** o app pega a imagem da câmera ou da galeria (`expo-image-picker`). Vale foto recebida pelo WhatsApp.
2. **Motor de OCR:** devolve só o **texto** reconhecido.
   - O motor atual é `motorOcrApi` (`apps/app/src/lib/ocr.ts`). Ele manda a foto para `POST /ocr` na API.
   - A API (`apps/api/src/ocr.ts`) prepara a imagem com `sharp`:
     - corrige a orientação da câmera;
     - endireita a foto torta: mede a inclinação das linhas de texto (de -8° a 8°) e gira a imagem;
     - recorta só o papel (a mesa em volta vira "texto" lixo);
     - deixa o papel sempre com 1.700 px de largura, tanto na foto pequena do WhatsApp quanto na de 12 megapixels da câmera, para as letras saírem sempre do mesmo tamanho;
     - uniformiza a iluminação, dividindo cada ponto pela média da vizinhança, contra sombra e papel desbotado.
   - Depois roda o Tesseract (`tesseract.js`) no modo "bloco único", que mantém descrição e valor na mesma linha. O modelo de português vem empacotado no npm. Nada é baixado da internet, e a foto não é guardada.
3. **Texto → chave:** `chavesNoTexto` (`packages/sefaz/src/texto.ts`) procura 44 dígitos.
   - Aceita a chave em grupos de 4, quebrada em linhas, e corrige letras que o OCR confunde com dígitos (O→0, S→5, B→8...).
   - Só aceita uma chave com dígito verificador, UF, ano/mês e modelo válidos. Uma leitura errada não passa.
   - Se nada passar, `digitosProvaveisDaChave` sugere os números lidos, para a pessoa corrigir.
4. **Consulta:** a consulta pela chave pede um **captcha**.
   - **No celular**, o app abre a página da SEFAZ (`PaginaSefazVisivel`) com a chave preenchida. A pessoa digita o captcha. Quando a página com os itens aparece, o app lê e salva como num cupom com QR Code.
   - **Na Web**, não dá para ler a página de outro site: o app mostra a chave e o link da SEFAZ.

## Depois: OCR no próprio celular

Para a foto não sair do aparelho e funcionar sem internet, basta outro motor com a mesma interface `MotorOcr`:

```ts
export interface MotorOcr {
  nome: string;
  reconhecer(imagem: { base64: string }): Promise<string>;
}
```

O caminho natural é o **ML Kit** (Google), que roda no Android e no iOS. Ele usa código nativo que o **Expo Go não tem**, então exige um build próprio do app (`npx eas-cli@latest build --profile development`). O resto (`chavesNoTexto`, a tela de confirmação, a consulta) não muda.

## Etapa 2: cupons sem chave (itens lidos da foto)

Para cupons sem QR Code e sem chave, por exemplo de verdurões, feiras e caixas antigos, o app lê os itens do próprio texto da foto. O leitor fica em `packages/foto`.

```
texto do OCR ──► lerCupomDoTexto() ──► conferência da conta ──► desempate pela soma ──► revisão ──► salvarCupomFoto()
```

1. **Linhas do cupom.** Cada item começa com o número de sequência ("0001 LIMAO TAHITI"). O total fica na ponta direita, na mesma linha (itens de quantidade 1) ou na linha de baixo, com "quantidade KG X preço =". Também são lidos a loja, o endereço, o telefone, o CNPJ (se impresso), o número do cupom, a data e hora e o TOTAL.
2. **Conferência da conta.** O OCR costuma errar um ou dois dígitos, e a conta mostra qual.
   - O peso tem 3 casas e o preço 2, então "1890" é 18,90 mesmo sem vírgula.
   - O leitor procura a combinação de quantidade × preço = total (com arredondamento ou truncamento) que muda menos dígitos do que foi lido.
   - Exemplo: com 0,230 kg e R$ 2,76, o preço só pode ficar entre 11,98 e 12,02. Se o OCR leu "11,68", o certo é 11,98.
   - **Bom senso:** ignora leituras absurdas, como preço acima de R$ 500/kg, peso acima de 50 kg ou item maior que o cupom inteiro.
   - Quando é preciso mudar 4 ou mais dígitos, o leitor **não inventa**. Fica o total lido, e peso e preço vêm em branco para a pessoa completar.
   - O OCR troca o "X" por "Y" ou "A", lê "KG" como "K6", repete dígitos ("22,688", ano "20286") e deixa "?" no lugar de dígitos. O leitor entende esses casos.
3. **Desempate pela soma.** Quando uma linha tem mais de uma conta possível, o leitor escolhe a combinação que faz a soma dos itens bater com o TOTAL do cupom, mexendo no menor número de itens. O próprio TOTAL pode ter sido mal lido. Por isso, as linhas de pagamento logo abaixo (CARTÃO, DINHEIRO) servem de segunda opinião: vale o valor que bate com os itens mexendo menos.
4. **Revisão.** A pessoa vê tudo editável, com a foto ao lado para comparar.
   - Cada item mostra "✓ confere", "✓ corrigido pela conta" ou "⚠ confira com o cupom".
   - A tela avisa se a soma não bate com o total.
   - Nada é salvo sem passar por aqui.
5. **Salvar.** O cupom vai para as mesmas tabelas, com `origem = 'foto'`.
   - A chave é criada pelo app (loja, data, número e total), então fotografar o mesmo cupom de novo não duplica.
   - Sem CNPJ, a loja é identificada pelo nome. Uma loja já guardada com nome parecido é reaproveitada, porque o OCR pode ler "NASCENTF" numa semana e "NASCENTE" na outra.
   - Itens com descrição parecida com a de um produto já comprado na mesma loja ("ACEL GA UND" = "ACELGA UND") entram como o **mesmo produto**. Assim a variação de preço semana a semana funciona.

A classificação no IPCA usa só a descrição, então funciona igual à dos cupons da SEFAZ.

**Resultado com um cupom real de verdurão** (16 itens, foto sobre a mesa). Em três versões da foto (a original do WhatsApp, a mesma em resolução de câmera e inclinada 3°):
- todos os 16 totais saíram certos;
- o total do cupom saiu certo;
- 13 ou 14 itens saíram completos (peso, preço e total).

Os demais ficaram destacados, com peso e preço em branco ou para conferir. Os textos desses OCRs, anonimizados, são as fixtures em `packages/foto/test/fixtures/`.

### Limitações e próximos passos

- Uma foto por cupom. Cupons muito compridos podem precisar de várias fotos, juntadas depois.
- O leitor foi feito para o layout "sequência + descrição / quantidade X preço = total". Outros layouts entram com uma fixture do texto do OCR, anonimizada, e um teste em `packages/foto/test`.
- O OCR no celular (ML Kit) deve ler melhor as linhas de itens que o Tesseract.
