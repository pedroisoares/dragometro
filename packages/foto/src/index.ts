/**
 * Cupons sem QR Code e sem chave de acesso: lê loja, data, itens e total a partir do
 * TEXTO do OCR da foto, e confere os valores (quantidade × preço = total; soma = total).
 * Não depende do motor de OCR: serve para o da API hoje e para o do celular depois.
 */
export * from './conferir';
export * from './ler-cupom';
export * from './numeros';
export * from './semelhanca';
