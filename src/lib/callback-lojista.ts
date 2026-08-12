/**
 * ESPELHO de `Gateway-de-Pagamentos-VPay-api/src/shared/callback-lojista.ts`.
 *
 * O `status` do callback é a SITUAÇÃO DO SISTEMA — o mesmo valor que aparece no
 * painel e nos relatórios. Contrato público: o lojista escreve
 * `if (status === 'CONCLUIDA')`. Nunca renomear/remover valor daqui — só
 * acrescentar — e sempre junto com o arquivo da API. A documentação em
 * `/desenvolvedores/documentacao` é gerada desta lista.
 */

export type OperacaoCallback = 'cash_in' | 'cash_out';

/** Situações que o cash-in assume (sem PENDENTE/PROCESSANDO/CANCELADA). */
export const STATUS_CASH_IN = [
  'AGUARDANDO_PAGAMENTO',
  'CONCLUIDA',
  'FALHA',
  'MED',
] as const;

/**
 * Situações que o cash-out assume. Sem `CANCELADA`: nenhum fluxo cancela um
 * saque, e status que nunca chega faz o lojista escrever um `if` morto.
 */
export const STATUS_CASH_OUT = ['PROCESSANDO', 'CONCLUIDA', 'FALHA'] as const;

export type StatusCallback =
  | (typeof STATUS_CASH_IN)[number]
  | (typeof STATUS_CASH_OUT)[number];

/**
 * Reenvio manual só onde existe evento de outbox. Espelho de
 * `podeReenviarCallback` da API.
 */
export function podeReenviarCallback(
  situacao: string,
  direcao: 'ENTRADA' | 'SAIDA',
): boolean {
  if (direcao === 'ENTRADA') {
    return situacao === 'CONCLUIDA' || situacao === 'MED';
  }
  return situacao === 'CONCLUIDA' || situacao === 'FALHA';
}

export const STATUS_CALLBACK_DOC: Array<{
  status: StatusCallback;
  operacoes: OperacaoCallback[];
  descricao: string;
  terminal: boolean;
}> = [
  {
    status: 'AGUARDANDO_PAGAMENTO',
    operacoes: ['cash_in'],
    descricao:
      'Cobrança criada com código PIX válido, aguardando o pagador. É o estado inicial de toda venda.',
    terminal: false,
  },
  {
    status: 'PROCESSANDO',
    operacoes: ['cash_out'],
    descricao:
      'Saque com o saldo já debitado e a ordem enviada à liquidante, aguardando confirmação.',
    terminal: false,
  },
  {
    status: 'CONCLUIDA',
    operacoes: ['cash_in', 'cash_out'],
    descricao:
      'Cash-in: pago e creditado na carteira — é o gatilho para liberar o pedido. Cash-out: saque liquidado para o beneficiário.',
    terminal: true,
  },
  {
    status: 'FALHA',
    operacoes: ['cash_in', 'cash_out'],
    descricao:
      'A operação não vai adiante. No cash-in, nenhuma liquidante conseguiu gerar a cobrança nem pela contingência. No cash-out, a ordem não saiu (recusa da liquidante ou falha antes do envio) — valor e taxa voltam para a carteira.',
    terminal: true,
  },
  {
    status: 'MED',
    operacoes: ['cash_in'],
    descricao:
      'Venda devolvida ao pagador (MED aceito). Chega com data_med preenchida — estorne o pedido.',
    terminal: true,
  },
];
