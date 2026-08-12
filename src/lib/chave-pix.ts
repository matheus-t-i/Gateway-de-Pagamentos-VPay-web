import {
  isCnpj,
  isCpf,
  mascaraCnpj,
  mascaraCpf,
  mascaraTelefone,
  normalizarDocumento,
} from './documento';

export const TIPOS_CHAVE_PIX = [
  'CPF',
  'CNPJ',
  'EMAIL',
  'TELEFONE',
  'ALEATORIA',
] as const;

export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number];

const UUID_PIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PIX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** DDD + número. Corta `+55`/`55` de país (12+ dígitos); DDD 55 de 10/11 fica. */
export function digitosTelefoneChavePix(valor: string): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) {
    d = d.slice(2);
  }
  return d.slice(0, 11);
}

function uuidPix(valor: string): string {
  const hex = (valor ?? '')
    .replace(/[^0-9a-fA-F]/g, '')
    .toLowerCase()
    .slice(0, 32);
  if (hex.length === 0) return '';
  const partes = [8, 4, 4, 4, 12];
  const out: string[] = [];
  let i = 0;
  for (const n of partes) {
    if (i >= hex.length) break;
    out.push(hex.slice(i, i + n));
    i += n;
  }
  return out.join('-');
}

/** Valor enviado à API / gravado: sem máscara, telefone sem +55. */
export function normalizarChavePixCadastro(
  tipo: string,
  chave: string,
): string {
  const bruto = (chave ?? '').trim();
  switch (tipo) {
    case 'CPF':
      return bruto.replace(/\D/g, '').slice(0, 11);
    case 'CNPJ':
      return normalizarDocumento(bruto).slice(0, 14);
    case 'EMAIL':
      return bruto.toLowerCase();
    case 'TELEFONE':
      return digitosTelefoneChavePix(bruto);
    case 'ALEATORIA':
      return uuidPix(bruto);
    default:
      return bruto;
  }
}

export function chavePixValida(tipo: string, chave: string): boolean {
  const n = normalizarChavePixCadastro(tipo, chave);
  switch (tipo) {
    case 'CPF':
      return isCpf(n);
    case 'CNPJ':
      return isCnpj(n);
    case 'EMAIL':
      return EMAIL_PIX.test(n) && n.length <= 255;
    case 'TELEFONE':
      return n.length === 10 || n.length === 11;
    case 'ALEATORIA':
      return UUID_PIX.test(n);
    default:
      return false;
  }
}

/** Máscara de digitação — reusa CPF/CNPJ/telefone já existentes. */
export function mascararChavePix(tipo: string, valor: string): string {
  switch (tipo) {
    case 'CPF':
      return mascaraCpf(valor);
    case 'CNPJ':
      return mascaraCnpj(valor);
    case 'EMAIL':
      return (valor ?? '').replace(/\s/g, '').slice(0, 255);
    case 'TELEFONE':
      return mascaraTelefone(digitosTelefoneChavePix(valor));
    case 'ALEATORIA':
      return uuidPix(valor);
    default:
      return valor ?? '';
  }
}

export function metaCampoChavePix(tipo: string): {
  placeholder: string;
  inputMode: 'numeric' | 'email' | 'text';
  inputType: 'text' | 'email';
  maxLength: number;
  dica: string;
} {
  switch (tipo) {
    case 'CPF':
      return {
        placeholder: '000.000.000-00',
        inputMode: 'numeric',
        inputType: 'text',
        maxLength: 14,
        dica: 'Somente os 11 dígitos do CPF.',
      };
    case 'CNPJ':
      return {
        placeholder: '00.000.000/0000-00',
        inputMode: 'text',
        inputType: 'text',
        maxLength: 18,
        dica: '14 posições. Letras nas 12 primeiras (Receita) são aceitas.',
      };
    case 'EMAIL':
      return {
        placeholder: 'email@dominio.com',
        inputMode: 'email',
        inputType: 'email',
        maxLength: 255,
        dica: 'E-mail da chave PIX.',
      };
    case 'TELEFONE':
      return {
        placeholder: '(11) 99999-9999',
        inputMode: 'numeric',
        inputType: 'text',
        // Folga para colar `+55 (11) 99999-8888`; a máscara corta o país.
        maxLength: 20,
        dica: 'Só DDD + número. Não informe +55 — o sistema acrescenta na liquidante.',
      };
    case 'ALEATORIA':
      return {
        placeholder: '00000000-0000-0000-0000-000000000000',
        inputMode: 'text',
        inputType: 'text',
        maxLength: 36,
        dica: 'Chave aleatória no formato UUID.',
      };
    default:
      return {
        placeholder: '',
        inputMode: 'text',
        inputType: 'text',
        maxLength: 255,
        dica: '',
      };
  }
}
