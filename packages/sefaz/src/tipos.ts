export type UF =
  | 'RO' | 'AC' | 'AM' | 'RR' | 'PA' | 'AP' | 'TO'
  | 'MA' | 'PI' | 'CE' | 'RN' | 'PB' | 'PE' | 'AL' | 'SE' | 'BA'
  | 'MG' | 'ES' | 'RJ' | 'SP'
  | 'PR' | 'SC' | 'RS'
  | 'MS' | 'MT' | 'GO' | 'DF';

/** Os campos da chave de acesso de 44 dígitos. */
export interface ChaveAcesso {
  chave: string;
  codigoUF: string;
  uf: UF;
  /** Ano e mês de emissão, `AAAA-MM`. */
  anoMes: string;
  cnpjEmitente: string;
  /** 55 = NF-e, 65 = NFC-e. */
  modelo: string;
  serie: string;
  numero: string;
  tipoEmissao: string;
  codigoNumerico: string;
  digitoVerificador: string;
}

export interface ItemNota {
  /** Código interno do produto na loja. */
  codigo?: string;
  descricao: string;
  quantidade: number;
  /** Unidade como aparece no cupom (UN, KG, L...). */
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaFiscal {
  chave: string;
  uf: UF;
  emitente: {
    nome?: string;
    cnpj: string;
  };
  /** Data/hora de emissão em ISO, quando a página informa. */
  dataEmissao?: string;
  itens: ItemNota[];
  valorTotal?: number;
}

/**
 * Um leitor sabe extrair a nota da página de consulta da SEFAZ de um estado.
 * Para adicionar um estado, crie um arquivo em `src/leitores/` e registre em `src/leitores/index.ts`.
 */
export interface LeitorSefaz {
  /** Nome curto do layout, para logs e testes. */
  nome: string;
  /** Estados em que este leitor já foi validado com páginas reais (com fixture e teste). */
  ufs: UF[];
  ler(html: string, chave: ChaveAcesso): NotaFiscal;
}
