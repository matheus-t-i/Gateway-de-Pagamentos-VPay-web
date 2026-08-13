/**
 * Comparação de dinheiro no painel sem float.
 *
 * A API usa decimal.js; o web não puxa essa lib. Centavos inteiros a partir
 * da string decimal (`"24.15"` → 2415) evitam `0.1 + 0.2` e o `Number(valor)`
 * frouxo que deixava o botão de saque passar valor maior que o saldo.
 */

/** `"24.15"` / `"24,15"` / `"0"` → centavos. Inválido → NaN. */
export function centavosDe(decimal: string): number {
  const s = decimal.trim().replace(',', '.');
  if (!s) return NaN;
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return NaN;
  const sinal = m[1] === '-' ? -1 : 1;
  const inteiro = Number(m[2]);
  const frac = (m[3] ?? '').padEnd(2, '0');
  return sinal * (inteiro * 100 + Number(frac));
}

export function formatarBrl(decimal: string): string {
  const c = centavosDe(decimal);
  if (!Number.isFinite(c)) return decimal;
  return (c / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Mensagem de validação do valor de saque, ou null se ok / ainda vazio. */
export function mensagemValorSaque(params: {
  valor: string;
  saldoDisponivel?: string;
  ticketMinimoPixSaida?: string;
  ticketMaximoPixSaida?: string | null;
}): string | null {
  const v = centavosDe(params.valor);
  if (!params.valor || !Number.isFinite(v) || v <= 0) return null;

  if (params.ticketMinimoPixSaida) {
    const min = centavosDe(params.ticketMinimoPixSaida);
    if (Number.isFinite(min) && min > 0 && v < min) {
      return `Valor abaixo do mínimo (${formatarBrl(params.ticketMinimoPixSaida)})`;
    }
  }
  if (params.ticketMaximoPixSaida) {
    const max = centavosDe(params.ticketMaximoPixSaida);
    if (Number.isFinite(max) && max > 0 && v > max) {
      return `Valor acima do máximo (${formatarBrl(params.ticketMaximoPixSaida)})`;
    }
  }
  if (params.saldoDisponivel != null && params.saldoDisponivel !== '') {
    const s = centavosDe(params.saldoDisponivel);
    if (Number.isFinite(s) && v > s) {
      return 'Valor maior que o saldo disponível';
    }
  }
  return null;
}
