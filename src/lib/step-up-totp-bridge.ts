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
  /** Abre o modal que coleta o código de 6 dígitos (registrado pelo host). */
  pedirCodigo: ((mensagem?: string) => Promise<string | null>) | null;
};

const bridge: TotpBridge = {
  totpHabilitado: null,
  abrirModalAtivar: () => {},
  pedirCodigo: null,
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
 *
 * O código é coletado por um MODAL React (nunca `window.prompt`): no celular a
 * pessoa troca para o aplicativo autenticador e volta — o prompt nativo é
 * descartado nessa troca e derrubava a ação inteira, com o formulário junto.
 * O modal continua aberto e o estado da tela por trás fica intacto.
 */
export async function pedirCodigoTotp(mensagem?: string): Promise<string | null> {
  if (bridge.totpHabilitado === false) {
    bridge.abrirModalAtivar();
    return null;
  }
  if (bridge.pedirCodigo) return bridge.pedirCodigo(mensagem);
  // Host ainda não montado (não deve acontecer nas telas autenticadas):
  // fallback no prompt nativo para não bloquear a operação.
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
