/**
 * ESPELHO de `Gateway-de-Pagamentos-VPay-api/src/shared/sessao-painel.ts`.
 *
 * Mexeu num, mexe nos dois. O painel usa `instanteRenovacao`/
 * `estaNaJanelaDeRenovacao` para saber QUANDO pedir token novo; a API usa
 * `renovacaoPermitida` para decidir se aceita. Se os dois lados discordarem, a
 * renovação não gera erro em lugar nenhum — ela só falha sempre, e a sessão
 * cai como se o recurso nunca tivesse existido.
 */

/**
 * O front renova quando restar esta fração da validade (25% restante = 75%
 * gasto). Token de 1h: pede token novo aos 45 min.
 */
export const FRACAO_RESTANTE_RENOVACAO = 0.25;

/**
 * A API aceita renovar a partir de METADE da validade gasta — o dobro da folga
 * de que o front precisa. A diferença é margem para relógio do navegador
 * adiantado: com o horário à frente do servidor o painel pediria "cedo demais",
 * levaria 403 e a sessão morreria por uma diferença de minutos no relógio de
 * quem está usando.
 */
export const FRACAO_MINIMA_GASTA_RENOVACAO = 0.5;

/**
 * Sobra menor que isto não vale renovação: o token novo venceria quase junto
 * com o atual, e o front só ficaria pedindo token até o fim.
 */
export const MARGEM_MINIMA_RENOVACAO_MS = 30_000;

/** Janela de vida de um token: `iat` e `exp` do JWT, já em milissegundos. */
export type JanelaToken = {
  emitidoEm: number;
  expiraEm: number;
};

/** Validade total do token em ms (0 se a janela não fizer sentido). */
function duracao({ emitidoEm, expiraEm }: JanelaToken): number {
  const total = expiraEm - emitidoEm;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * Instante (epoch ms) em que o front deve pedir a renovação.
 *
 * Sem `iat` coerente devolve o próprio vencimento — ou seja, não renova e a
 * sessão expira normalmente. É o desfecho seguro: token que não sabemos ler
 * não ganha vida extra.
 */
export function instanteRenovacao(janela: JanelaToken): number {
  const total = duracao(janela);
  if (!total) return janela.expiraEm;
  return janela.expiraEm - total * FRACAO_RESTANTE_RENOVACAO;
}

/** Já passou da hora de renovar e ainda dá tempo de trocar o token? */
export function estaNaJanelaDeRenovacao(janela: JanelaToken, agora: number): boolean {
  return (
    agora >= instanteRenovacao(janela) &&
    agora < janela.expiraEm - MARGEM_MINIMA_RENOVACAO_MS
  );
}

/**
 * Regra do SERVIDOR: token recém-emitido não renova.
 *
 * Sem esta trava, um cliente pedindo `/auth/renovar` em laço ganharia um token
 * novo por chamada e a sessão de 1h viraria eterna sem ninguém digitar senha.
 */
export function renovacaoPermitida(janela: JanelaToken, agora: number): boolean {
  const total = duracao(janela);
  if (!total) return false;
  return agora - janela.emitidoEm >= total * FRACAO_MINIMA_GASTA_RENOVACAO;
}
