/**
 * ÚNICO lugar para alterar a identidade do gateway.
 * Mudar aqui reflete em todo o sistema (login, cadastro, documentos legais,
 * rodapés, contatos e páginas de suporte).
 */
export const BRAND = {
  /** Nome comercial exibido em todo o sistema. */
  nome: 'VPay',
  /** Site institucional. */
  site: 'https://vpay.com.br',
  /** E-mail de contato/suporte. */
  email: 'contato@vpay.com.br',
  /** WhatsApp de suporte (formato exibível). */
  whatsapp: '+55 (11) 99999-9999',
  /** Link direto do WhatsApp (wa.me, somente dígitos com DDI). */
  whatsappLink: 'https://wa.me/5511999999999',
  /** Versão vigente do conjunto de documentos legais. */
  docsVersao: '2.0.0',
} as const;
