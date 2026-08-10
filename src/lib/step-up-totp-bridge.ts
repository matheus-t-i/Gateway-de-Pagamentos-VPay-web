/**
 * Bridge sem React: `pedirCodigoTotp` e o client HTTP leem/escrevem aqui;
 * o `StepUpTotpHost` registra o opener do modal e o flag do auth.
 */

/** Mensagem exata do `assertStepUpTotp` na API (403) sem TOTP ativo. */
export const MSG_TOTP_OBRIGATORIO =
  'Ative a verificação em duas etapas na sua conta para executar esta operação.';

/** Rota da área de ativação do 2FA em Configurações. */
export const ROTA_ATIVAR_2FA = '/configuracoes#seguranca';

type TotpBridge = {
  /** `false` = sem 2FA; `true` = ativo; `null` = ainda não sabemos. */
  totpHabilitado: boolean | null;
  abrirModalAtivar: () => void;
};

const bridge: TotpBridge = {
  totpHabilitado: null,
  abrirModalAtivar: () => {},
};

/** Registra o host React (modal + estado do auth). Só uso interno. */
export function registrarStepUpTotp(parcial: Partial<TotpBridge>) {
  Object.assign(bridge, parcial);
}

export function ehErroTotpObrigatorio(erro: unknown): boolean {
  const msg =
    typeof erro === 'string'
      ? erro
      : erro instanceof Error
        ? erro.message
        : '';
  return msg.includes(MSG_TOTP_OBRIGATORIO);
}

/**
 * Se a API devolveu o 403 de TOTP obrigatório, abre o modal de ativação.
 * Chamado pelo client HTTP — mutações que pulam `pedirCodigoTotp` também
 * ganham o CTA.
 */
export function avisarTotpObrigatorioSeAplicavel(mensagem: string): void {
  if (ehErroTotpObrigatorio(mensagem)) {
    bridge.abrirModalAtivar();
  }
}

/**
 * Pede o código TOTP de step-up para mutações autenticadas.
 *
 * Se a conta ainda não tem 2FA, abre o modal com CTA para Configurações e
 * devolve `null` (não chega a pedir o código).
 */
export function pedirCodigoTotp(mensagem?: string): string | null {
  if (bridge.totpHabilitado === false) {
    bridge.abrirModalAtivar();
    return null;
  }
  const codigo = window.prompt(
    mensagem ?? 'Confirme com o código 2FA (6 dígitos) da sua conta:',
  );
  if (codigo === null) return null;
  const limpo = codigo.trim();
  if (!/^\d{6}$/.test(limpo)) {
    window.alert('Código 2FA inválido — informe exatamente 6 dígitos.');
    return null;
  }
  return limpo;
}
