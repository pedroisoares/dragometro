// Gera src/catalogo.ts a partir de dados/catalogo-ipca.txt.
// O .txt é a fonte: categorias da tabela 7060 do SIDRA (classificação 315),
// no formato "codigoIBGE|codigoSIDRA|nome". Rode com `pnpm gerar-catalogo`.
import { readFileSync, writeFileSync } from 'node:fs';

const linhas = readFileSync(new URL('../dados/catalogo-ipca.txt', import.meta.url), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('|'));

const corpo = linhas.map(([codigo, sidra, nome]) => `  [${JSON.stringify(codigo)}, ${JSON.stringify(sidra)}, ${JSON.stringify(nome)}],`).join('\n');

writeFileSync(
  new URL('../src/catalogo.ts', import.meta.url),
  `// ARQUIVO GERADO por scripts/gerar-catalogo.mjs a partir de dados/catalogo-ipca.txt. Não edite à mão.
// Fonte: IBGE, SIDRA tabela 7060 (IPCA por subitem), classificação 315, consultada em nov/2026.
// Formato: [código IBGE, código SIDRA, nome]. O código "0" é o índice geral.
export const CATALOGO_BRUTO: readonly (readonly [string, string, string])[] = [
${corpo}
];
`,
);
console.log(`${linhas.length} categorias`);
