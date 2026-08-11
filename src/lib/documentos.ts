/**
 * Tipos de documento e seus rótulos — FONTE ÚNICA do painel.
 *
 * Espelha `TIPOS_DOCUMENTO` de
 * `Gateway-de-Pagamentos-VPay-api/src/shared/enums.ts`. Os rótulos viviam só
 * dentro de `/onboarding/documentos`; com o admin também subindo documento pela
 * ficha do cliente, duas telas passaram a precisar dos mesmos nomes — e duas
 * cópias divergem na primeira vez que um rótulo muda.
 */

export const TIPOS_DOCUMENTO = {
  RG_CNH_FRENTE: 'RG_CNH_FRENTE',
  RG_CNH_VERSO: 'RG_CNH_VERSO',
  SELFIE_COM_DOCUMENTO: 'SELFIE_COM_DOCUMENTO',
  CONTRATO_SOCIAL: 'CONTRATO_SOCIAL',
  CARTAO_CNPJ: 'CARTAO_CNPJ',
  COMPROVANTE_ENDERECO_EMPRESA: 'COMPROVANTE_ENDERECO_EMPRESA',
  /** Enviado pela VPay depois que o cliente assina — nunca exigido do cliente. */
  CONTRATO_PRESTACAO_SERVICO: 'CONTRATO_PRESTACAO_SERVICO',
} as const;

export type TipoDocumento =
  (typeof TIPOS_DOCUMENTO)[keyof typeof TIPOS_DOCUMENTO];

export const ROTULOS_DOCUMENTO: Record<string, string> = {
  RG_CNH_FRENTE: 'Foto da frente do RG ou CNH',
  RG_CNH_VERSO: 'Foto do verso do RG ou CNH',
  SELFIE_COM_DOCUMENTO: 'Selfie segurando o RG ou CNH',
  CONTRATO_SOCIAL: 'Contrato social',
  CARTAO_CNPJ: 'Cartão CNPJ',
  COMPROVANTE_ENDERECO_EMPRESA: 'Comprovante de endereço da pessoa jurídica',
  CONTRATO_PRESTACAO_SERVICO: 'Contrato de prestação de serviço',
};

export const rotuloDocumento = (tipo: string) => ROTULOS_DOCUMENTO[tipo] ?? tipo;

/** Documentos pessoais do titular (PF) ou do responsável (PJ). */
export const DOCUMENTOS_PESSOAIS: TipoDocumento[] = [
  TIPOS_DOCUMENTO.RG_CNH_FRENTE,
  TIPOS_DOCUMENTO.RG_CNH_VERSO,
  TIPOS_DOCUMENTO.SELFIE_COM_DOCUMENTO,
];

/** Documentos societários — exigidos só de PJ. */
export const DOCUMENTOS_EMPRESA: TipoDocumento[] = [
  TIPOS_DOCUMENTO.CONTRATO_SOCIAL,
  TIPOS_DOCUMENTO.CARTAO_CNPJ,
  TIPOS_DOCUMENTO.COMPROVANTE_ENDERECO_EMPRESA,
];

/**
 * Ordem de exibição no seletor de upload do admin: primeiro o que o cliente
 * deveria ter enviado, por último o contrato, que é o único que nasce da VPay.
 */
export function tiposParaUploadAdmin(tipoPessoa: 'PF' | 'PJ'): TipoDocumento[] {
  return [
    ...DOCUMENTOS_PESSOAIS,
    ...(tipoPessoa === 'PJ' ? DOCUMENTOS_EMPRESA : []),
    TIPOS_DOCUMENTO.CONTRATO_PRESTACAO_SERVICO,
  ];
}
