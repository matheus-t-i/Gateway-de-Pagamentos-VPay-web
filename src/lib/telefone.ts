/**
 * Telefone de CONTATO da conta (cadastro, ficha cadastral do admin).
 *
 * ESPELHO de `Gateway-de-Pagamentos-VPay-api/src/shared/telefone.ts` — mesma
 * regra e mesmas mensagens, para o painel recusar antes de chamar a API e
 * dizer a mesma coisa que ela diria: DDD real da Anatel, celular com o nono
 * dígito `9` ou fixo começando em 2–5, e nada de sequência repetida.
 *
 * Grava DDD + número em dígitos, sem `+55` (igual à chave PIX de telefone).
 * A máscara de digitação continua em `documento.ts` (`mascaraTelefone`).
 */

/** DDDs em uso no Brasil (Anatel). */
export const DDDS_VALIDOS: ReadonlySet<string> = new Set([
  // SP
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // RJ / ES
  '21', '22', '24', '27', '28',
  // MG
  '31', '32', '33', '34', '35', '37', '38',
  // PR / SC
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // RS
  '51', '53', '54', '55',
  // DF / GO / TO / MT / MS / AC / RO
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  // BA / SE
  '71', '73', '74', '75', '77', '79',
  // PE / AL / PB / RN / CE / PI
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  // PA / AM / RR / AP / MA
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

export const MENSAGEM_TELEFONE = {
  OBRIGATORIO: 'Informe o telefone.',
  TAMANHO: 'Telefone deve ter DDD e número: (DD) 9NNNN-NNNN para celular ou (DD) NNNN-NNNN para fixo.',
  DDD: 'DDD inválido. Confira os dois primeiros dígitos.',
  CELULAR: 'Celular deve começar com 9 depois do DDD: (DD) 9NNNN-NNNN.',
  FIXO: 'Telefone fixo deve começar com 2, 3, 4 ou 5 depois do DDD.',
  REPETIDO: 'Telefone inválido: informe um número real, não uma sequência repetida.',
} as const;

/** Só dígitos, sem `+55` (quando sobram 12+) e sem zero de tronco (quando sobram 11+). */
export function normalizarTelefone(valor: string | null | undefined): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  return d;
}

/** Motivo da recusa (ou `null` se válido). Aceita o valor com máscara. */
export function motivoTelefoneInvalido(valor: string | null | undefined): string | null {
  const d = normalizarTelefone(valor);
  if (d.length === 0) return MENSAGEM_TELEFONE.OBRIGATORIO;
  if (d.length !== 10 && d.length !== 11) return MENSAGEM_TELEFONE.TAMANHO;
  if (!DDDS_VALIDOS.has(d.slice(0, 2))) return MENSAGEM_TELEFONE.DDD;
  const numero = d.slice(2);
  if (d.length === 11 && numero[0] !== '9') return MENSAGEM_TELEFONE.CELULAR;
  if (d.length === 10 && !/^[2-5]/.test(numero)) return MENSAGEM_TELEFONE.FIXO;
  const assinante = d.length === 11 ? numero.slice(1) : numero;
  if (assinante.split('').every((c) => c === assinante[0])) {
    return MENSAGEM_TELEFONE.REPETIDO;
  }
  return null;
}

export function telefoneContatoValido(valor: string | null | undefined): boolean {
  return motivoTelefoneInvalido(valor) === null;
}
