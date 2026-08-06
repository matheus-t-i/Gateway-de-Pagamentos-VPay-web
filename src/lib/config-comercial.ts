/**
 * Vocabulário das condições comerciais do cliente — espelho de
 * `src/shared/situacoes.ts` da API (`MODO_TRATAMENTO_MED`, `BASE_CALCULO_RESERVA`).
 *
 * Fonte única dos rótulos: o mesmo texto aparece no cadastro do cliente
 * (`/admin/usuarios/[id]`) e no padrão de novos clientes, e essas duas telas não
 * podem explicar a mesma regra de jeitos diferentes.
 */

export const MODO_TRATAMENTO_MED = {
  BLOQUEAR_SALDO: 'BLOQUEAR_SALDO',
  DEBITAR_IMEDIATAMENTE: 'DEBITAR_IMEDIATAMENTE',
} as const;

export type ModoTratamentoMed =
  (typeof MODO_TRATAMENTO_MED)[keyof typeof MODO_TRATAMENTO_MED];

export const MODOS_MED: ReadonlyArray<{
  v: ModoTratamentoMed;
  label: string;
  dica: string;
}> = [
  {
    v: MODO_TRATAMENTO_MED.BLOQUEAR_SALDO,
    label: 'Bloquear',
    dica:
      'Bloqueia o valor no saldo do cliente e manda o caso para análise em MED. É o padrão.',
  },
  {
    v: MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE,
    label: 'Debitar direto',
    dica:
      'Sem análise: a venda vira MED, o valor sai do saldo na hora e o caso já nasce encerrado.',
  },
];

export const BASE_CALCULO_RESERVA = {
  VALOR_BRUTO: 'VALOR_BRUTO',
  VALOR_LIQUIDO_EMPRESA: 'VALOR_LIQUIDO_EMPRESA',
} as const;

export type BaseCalculoReserva =
  (typeof BASE_CALCULO_RESERVA)[keyof typeof BASE_CALCULO_RESERVA];

export const BASES_RESERVA: ReadonlyArray<{
  v: BaseCalculoReserva;
  label: string;
  dica: string;
}> = [
  {
    v: BASE_CALCULO_RESERVA.VALOR_LIQUIDO_EMPRESA,
    label: 'Líquido',
    dica: 'Reserva calculada sobre o valor da venda já sem a taxa do gateway.',
  },
  {
    v: BASE_CALCULO_RESERVA.VALOR_BRUTO,
    label: 'Bruto',
    dica: 'Reserva calculada sobre o valor cheio da venda, antes da taxa.',
  },
];

/** "90" → "3 meses"; ajuda o admin a conferir o prazo que digitou. */
export function prazoEmMeses(dias: string | number): string {
  const n = Number(dias);
  if (!Number.isFinite(n) || n <= 0) return 'libera junto com o saldo';
  if (n < 30) return `${n} dia(s)`;
  const meses = n / 30;
  return Number.isInteger(meses)
    ? `${n} dias (~${meses} ${meses === 1 ? 'mês' : 'meses'})`
    : `${n} dias (~${meses.toFixed(1).replace('.', ',')} meses)`;
}
