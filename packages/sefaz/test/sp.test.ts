import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estadoValidado, lerNotaDaPagina } from '../src';

// Páginas reais da SEFAZ-SP (nov/2026), com CPF e chave de acesso anonimizados.
const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');
const soma = (valores: number[]) => Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;

describe('SEFAZ-SP', () => {
  it('está marcado como estado validado', () => {
    expect(estadoValidado('SP')).toBe(true);
  });

  it('lê o cupom de supermercado (24 itens, mistura de KG e UN)', () => {
    const nota = lerNotaDaPagina(fixture('sp-1.html'), '35261143259548002298652260000291801000000007');

    expect(nota.uf).toBe('SP');
    expect(nota.emitente).toEqual({ nome: 'Supermercados Cavicchiolli Ltda', cnpj: '43259548002298' });
    expect(nota.dataEmissao).toBe('2026-11-14T09:15:59');
    expect(nota.valorTotal).toBe(552.92);
    expect(nota.itens).toHaveLength(24);
    expect(soma(nota.itens.map((i) => i.valorTotal))).toBe(552.92);

    expect(nota.itens[0]).toEqual({
      codigo: '15559',
      descricao: 'PRES COZ SADIA S CP BAND KG',
      quantidade: 0.204,
      unidade: 'KG',
      valorUnitario: 32.79,
      valorTotal: 6.69,
    });
    expect(nota.itens[20]).toEqual({
      codigo: '15037',
      descricao: 'ARROZ B LEGAL AGULH 5KG',
      quantidade: 1,
      unidade: 'UN',
      valorUnitario: 29.9,
      valorTotal: 29.9,
    });
    expect(nota.itens.at(-1)!.descricao).toBe('PH FAMILIAR FD N 30 L16P15');
  });

  it('lê o cupom de açougue (unidade "KG0001" e valor unitário com 6 casas)', () => {
    const nota = lerNotaDaPagina(fixture('sp-2.html'), '35261150234608000159651040000283221000000004');

    expect(nota.emitente.nome).toBe('COMERCIAL PADRE BENTO SECOS E MOLHADOS L');
    expect(nota.dataEmissao).toBe('2026-11-07T12:57:00');
    expect(nota.valorTotal).toBe(391.13);
    expect(nota.itens).toHaveLength(11);
    expect(soma(nota.itens.map((i) => i.valorTotal))).toBe(391.13);

    expect(nota.itens[0]).toEqual({
      codigo: '97',
      descricao: 'PATINHO KG',
      quantidade: 0.826,
      unidade: 'KG0001',
      valorUnitario: 54.903148,
      valorTotal: 45.35,
    });
    // O mesmo produto aparece em várias linhas (uma por pesagem).
    expect(nota.itens.filter((i) => i.codigo === '122')).toHaveLength(7);
  });
});
