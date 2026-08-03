/**
 * Máscaras e validação de CPF/CNPJ.
 *
 * CNPJ ALFANUMÉRICO (novo padrão da Receita Federal): 14 posições, sendo as 12
 * primeiras alfanuméricas (0-9, A-Z) e as 2 últimas (DV) sempre numéricas.
 * CPF: 11 posições numéricas.
 */

export function normalizarDocumento(valor: string): string {
  return (valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isCpf(valor: string): boolean {
  return /^[0-9]{11}$/.test(valor);
}

export function isCnpj(valor: string): boolean {
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(valor);
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

export function mascaraTelefone(valor: string): string {
  const v = (valor ?? '').replace(/\D/g, '').slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}
