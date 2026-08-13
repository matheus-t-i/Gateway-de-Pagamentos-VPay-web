/**
 * ESPELHO de `src/shared/limites-valor.ts` da API.
 *
 * A frase precisa ser a MESMA dos dois lados: o painel valida enquanto a
 * pessoa digita (para ela nem chegar a enviar) e a API valida de novo no POST.
 * Se os textos divergirem, o mesmo valor recusado explica uma coisa no campo e
 * outra no alerta de erro — e quem lê acha que são dois problemas diferentes.
 *
 * Aqui é centavo inteiro, não decimal.js: o painel não carrega a lib, e
 * `Number("0.1") + Number("0.2")` já foi bug de saque neste código.
 */
import { centavosDe, formatarBrl } from './dinheiro';

export const OPERACAO_LIMITE = {
  COBRANCA: 'cobranca',
  SAQUE: 'saque',
} as const;

export type OperacaoLimite =
  (typeof OPERACAO_LIMITE)[keyof typeof OPERACAO_LIMITE];

/** Strings decimais como a API devolve (`"10.00"`); `maximo` nulo = sem teto. */
export type Faixa = {
  minimo?: string | null;
  maximo?: string | null;
};

const ROTULO: Record<OperacaoLimite, { nome: string; unidade: string }> = {
  [OPERACAO_LIMITE.COBRANCA]: { nome: 'cobrança PIX', unidade: 'por cobrança' },
  [OPERACAO_LIMITE.SAQUE]: { nome: 'saque PIX', unidade: 'por saque' },
};

/** `null` quando não há limite nenhum configurado — não há o que anunciar. */
export function faixaPermitidaTexto(
  faixa: Faixa,
  operacao: OperacaoLimite,
): string | null {
  const min = faixa.minimo ? centavosDe(faixa.minimo) : NaN;
  const max = faixa.maximo ? centavosDe(faixa.maximo) : NaN;
  const temMin = Number.isFinite(min) && min > 0;
  const temMax = Number.isFinite(max) && max > 0;
  const { unidade } = ROTULO[operacao];

  if (temMin && temMax)
    return `de ${formatarBrl(faixa.minimo!)} a ${formatarBrl(faixa.maximo!)} ${unidade}`;
  if (temMin) return `a partir de ${formatarBrl(faixa.minimo!)} ${unidade}`;
  if (temMax) return `até ${formatarBrl(faixa.maximo!)} ${unidade}`;
  return null;
}

/** Mesma frase de `checarLimiteValor` na API. `null` = valor dentro da faixa. */
export function mensagemForaDaFaixa(
  valor: string,
  faixa: Faixa,
  operacao: OperacaoLimite,
): string | null {
  const v = centavosDe(valor);
  if (!valor || !Number.isFinite(v) || v <= 0) return null;

  const min = faixa.minimo ? centavosDe(faixa.minimo) : NaN;
  const max = faixa.maximo ? centavosDe(faixa.maximo) : NaN;
  const abaixo = Number.isFinite(min) && min > 0 && v < min;
  const acima = Number.isFinite(max) && max > 0 && v > max;
  if (!abaixo && !acima) return null;

  const permitido = faixaPermitidaTexto(faixa, operacao);
  const lado = abaixo ? 'menor que o mínimo' : 'maior que o máximo';
  return (
    `O valor ${formatarBrl(valor)} é ${lado} permitido para ` +
    `${ROTULO[operacao].nome}.` +
    (permitido ? ` Aceitamos ${permitido}.` : '')
  );
}

/**
 * Validação do campo de valor do SAQUE: faixa + saldo.
 *
 * O saldo é checado por último de propósito — "acima do máximo" é regra da
 * conta e "maior que o saldo" é situação do momento; anunciar a regra primeiro
 * evita a pessoa depositar para descobrir que o teto era outro.
 */
export function mensagemValorSaque(params: {
  valor: string;
  saldoDisponivel?: string;
  ticketMinimoPixSaida?: string | null;
  ticketMaximoPixSaida?: string | null;
}): string | null {
  const foraDaFaixa = mensagemForaDaFaixa(
    params.valor,
    {
      minimo: params.ticketMinimoPixSaida,
      maximo: params.ticketMaximoPixSaida,
    },
    OPERACAO_LIMITE.SAQUE,
  );
  if (foraDaFaixa) return foraDaFaixa;

  const v = centavosDe(params.valor);
  if (!params.valor || !Number.isFinite(v) || v <= 0) return null;
  if (params.saldoDisponivel != null && params.saldoDisponivel !== '') {
    const s = centavosDe(params.saldoDisponivel);
    if (Number.isFinite(s) && v > s) {
      return `O valor ${formatarBrl(params.valor)} é maior que o seu saldo disponível (${formatarBrl(params.saldoDisponivel)}).`;
    }
  }
  return null;
}
