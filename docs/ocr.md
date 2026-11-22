# OCR: como a foto do cupom vira dados

## Hoje (etapa 1): foto da chave de acesso

```
foto ──► motor de OCR ──► texto ──► chavesNoTexto() ──► chave válida? ──► consulta na SEFAZ
         (API: Tesseract)           (pacote sefaz)       (dígito verificador)  (captcha pela pessoa)
```

1. **Foto:** o app pega a imagem da câmera ou da galeria (`expo-image-picker`). Vale foto recebida pelo WhatsApp.
2. **Motor de OCR:** devolve só o **texto** reconhecido.
   - O motor atual é `motorOcrApi` (`apps/app/src/lib/ocr.ts`). Ele manda a foto para `POST /ocr` na API.
   - A API (`apps/api/src/ocr.ts`) prepara a imagem com `sharp`: corrige a orientação da câmera, passa para tons de cinza, aumenta o contraste e amplia fotos pequenas. Depois roda o Tesseract (`tesseract.js`), com o modelo de português empacotado no npm. Nada é baixado da internet, e a foto não é guardada.
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

## Etapa 2: cupons sem chave

Para cupons sem chave de acesso (cupons antigos de ECF, "não é documento fiscal"), o plano é ler os **itens** pelo OCR. Haveria uma tela de revisão antes de salvar e conferências automáticas (quantidade × preço = total do item; soma dos itens = total do cupom). O cupom ficaria marcado com a origem "foto".
