/**
 * Máscaras e validação de CPF/CNPJ.
 *
 * CNPJ ALFANUMÉRICO (novo padrão da Receita Federal): 14 posições, sendo as 12
 * primeiras alfanuméricas (0-9, A-Z) e as 2 últimas (DV) sempre numéricas.
 * CPF: 11 posições numéricas.
 *
 * ESPELHO de `Gateway-de-Pagamentos-VPay-api/src/shared/documento.ts` — mesma
 * regra e mesmas mensagens. `isCpf`/`isCnpj` conferem só FORMATO;
 * `cpfTemDigitosValidos`/`cnpjTemDigitosValidos`/`documentoValidoPara` conferem
 * os DÍGITOS VERIFICADORES, que é o que o cadastro exige.
 */

export function normalizarDocumento(valor: string): string {
  return (valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Só formato: 11 dígitos. Para cadastro, use `cpfTemDigitosValidos`. */
export function isCpf(valor: string): boolean {
  return /^[0-9]{11}$/.test(valor);
}

/** Só formato: CNPJ numérico ou alfanumérico. Para cadastro, use `cnpjTemDigitosValidos`. */
export function isCnpj(valor: string): boolean {
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(valor);
}

function sequenciaRepetida(valor: string): boolean {
  return valor.length > 0 && valor.split('').every((c) => c === valor[0]);
}

/** CPF com DV (módulo 11) e que não seja `111.111.111-11` e afins. */
export function cpfTemDigitosValidos(valor: string): boolean {
  if (!isCpf(valor) || sequenciaRepetida(valor)) return false;
  const dv = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return valor.slice(9) === `${dv(valor.slice(0, 9))}${dv(valor.slice(0, 10))}`;
}

/**
 * CNPJ (numérico ou alfanumérico) com DV: cada caractere vale (ASCII − 48),
 * pesos 2..9 cíclicos contados da direita. `00.000.000/0000-00` fecha o
 * módulo 11, por isso a sequência repetida é recusada à parte.
 */
export function cnpjTemDigitosValidos(valor: string): boolean {
  if (!isCnpj(valor) || sequenciaRepetida(valor)) return false;
  const calcula = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      const peso = ((base.length - 1 - i) % 8) + 2;
      soma += (base.charCodeAt(i) - 48) * peso;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calcula(valor.slice(0, 12));
  const dv2 = calcula(valor.slice(0, 12) + String(dv1));
  return valor.slice(12) === `${dv1}${dv2}`;
}

/** Documento esperado para o tipo de pessoa, COM dígitos verificadores. */
export function documentoValidoPara(tipoPessoa: 'PF' | 'PJ', valor: string): boolean {
  return tipoPessoa === 'PF' ? cpfTemDigitosValidos(valor) : cnpjTemDigitosValidos(valor);
}

export const MENSAGEM_DOCUMENTO = {
  CPF_FORMATO: 'CPF inválido: informe os 11 dígitos.',
  CPF_DV: 'CPF inválido: os dígitos verificadores não conferem. Confira o número digitado.',
  CNPJ_FORMATO:
    'CNPJ inválido: informe as 14 posições (o novo padrão aceita letras nas 12 primeiras).',
  CNPJ_DV: 'CNPJ inválido: os dígitos verificadores não conferem. Confira o número digitado.',
} as const;

/** Motivo da recusa (ou `null` se válido) — a mesma frase que a API devolve. */
export function motivoDocumentoInvalido(
  tipoPessoa: 'PF' | 'PJ',
  valor: string,
): string | null {
  const v = normalizarDocumento(valor);
  if (tipoPessoa === 'PF') {
    if (!isCpf(v)) return MENSAGEM_DOCUMENTO.CPF_FORMATO;
    return cpfTemDigitosValidos(v) ? null : MENSAGEM_DOCUMENTO.CPF_DV;
  }
  if (!isCnpj(v)) return MENSAGEM_DOCUMENTO.CNPJ_FORMATO;
  return cnpjTemDigitosValidos(v) ? null : MENSAGEM_DOCUMENTO.CNPJ_DV;
}

/** Máscara de CPF: 000.000.000-00 (somente dígitos). */
export function mascaraCpf(valor: string): string {
  const v = (valor ?? '').replace(/\D/g, '').slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

/**
 * Máscara de CNPJ: 00.000.000/0000-00.
 * As 12 primeiras posições aceitam letras (padrão alfanumérico); as 2 últimas,
 * apenas dígitos.
 */
export function mascaraCnpj(valor: string): string {
  const bruto = normalizarDocumento(valor).slice(0, 14);
  const base = bruto.slice(0, 12);
  const dv = bruto.slice(12).replace(/\D/g, '');
  const v = base + dv;

  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12)
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function mascaraDocumento(tipoPessoa: 'PF' | 'PJ', valor: string): string {
  return tipoPessoa === 'PF' ? mascaraCpf(valor) : mascaraCnpj(valor);
}

/** Formata um documento já normalizado vindo da API (CPF ou CNPJ). */
export function formatarDocumento(valor: string): string {
  const v = normalizarDocumento(valor);
  if (v.length === 11) return mascaraCpf(v);
  if (v.length === 14) return mascaraCnpj(v);
  return v;
}

export function mascaraCep(valor: string): string {
  const v = (valor ?? '').replace(/\D/g, '').slice(0, 8);
  return v.length <= 5 ? v : `${v.slice(0, 5)}-${v.slice(5)}`;
}

/**
 * Máscara `(DD) 9NNNN-NNNN` / `(DD) NNNN-NNNN`. Se a pessoa COLAR `+55 11 …`,
 * o código do país sai antes do corte em 11 dígitos — senão o `55` virava DDD
 * e o número ficava truncado sem ninguém entender por quê.
 */
export function mascaraTelefone(valor: string): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  const v = d.slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}
