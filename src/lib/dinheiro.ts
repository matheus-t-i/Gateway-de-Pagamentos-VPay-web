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

/**
 * `mensagemValorSaque` mudou de casa: agora é `@/lib/limites-valor`, junto da
 * frase espelhada da API — a mensagem de limite tem que ser idêntica à da
 * recusa do servidor, e mantê-la aqui deixava as duas versões livres para
 * divergir.
 */
