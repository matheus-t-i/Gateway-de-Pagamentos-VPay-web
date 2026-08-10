/**
 * Espelho de `Gateway-de-Pagamentos-VPay-api/src/shared/upload-documento.ts`.
 * Validação de UX no cliente — a API revalida de verdade.
 */

export const MIMES_DOCUMENTO_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const TAMANHO_MAX_PDF_BYTES = 5 * 1024 * 1024;
export const TAMANHO_MAX_IMAGEM_BYTES = 10 * 1024 * 1024;

export const ACCEPT_DOCUMENTO =
  'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

export const TEXTO_LIMITES_DOCUMENTO =
  'PDF (máx. 5 MB) ou PNG/JPEG (máx. 10 MB)';

function eMimePermitido(mime: string): boolean {
  return (MIMES_DOCUMENTO_PERMITIDOS as readonly string[]).includes(mime);
}

function tamanhoMaximoParaMime(mime: string): number {
  if (mime === 'application/pdf') return TAMANHO_MAX_PDF_BYTES;
  return TAMANHO_MAX_IMAGEM_BYTES;
}

/**
 * Valida antes do FormData. Devolve mensagem em português ou null se ok.
 * Alguns browsers mandam `type` vazio — aí caímos na extensão do nome.
 */
export function mensagemErroArquivoDocumento(arquivo: File): string | null {
  let mime = arquivo.type;
  if (!mime) {
    const nome = arquivo.name.toLowerCase();
    if (nome.endsWith('.pdf')) mime = 'application/pdf';
    else if (nome.endsWith('.png')) mime = 'image/png';
    else if (nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
      mime = 'image/jpeg';
    }
  }
  if (!eMimePermitido(mime)) {
    return 'Tipo de arquivo não permitido. Envie apenas PDF, PNG ou JPEG.';
  }
  const teto = tamanhoMaximoParaMime(mime);
  if (arquivo.size <= 0) {
    return 'Arquivo vazio ou inválido.';
  }
  if (arquivo.size > teto) {
    const mb = teto / (1024 * 1024);
    if (mime === 'application/pdf') {
      return `O PDF deve ter no máximo ${mb} MB.`;
    }
    return `A imagem deve ter no máximo ${mb} MB.`;
  }
  return null;
}
