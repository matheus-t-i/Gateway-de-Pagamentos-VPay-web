/**
 * Diálogos de texto e confirmação por MODAL React — substitutos de
 * `window.prompt`/`window.confirm`, que no celular são descartados quando a
 * pessoa troca de aplicativo (para pegar um código, conferir um dado) e
 * derrubam a ação inteira. O modal fica aberto e o que já foi digitado
 * permanece. Mesmo padrão de bridge do step-up TOTP: o host React registra as
 * funções aqui; call site nenhum importa React por causa disso.
 */

export type OpcoesPedirTexto = {
  titulo: string;
  /** Explicação acima do campo (consequência da ação). */
  mensagem?: string;
  /** Rótulo do campo. */
  rotulo?: string;
  /** Mínimo de caracteres (após trim). Omitido/0 = campo opcional. */
  minimo?: number;
  /** Teto de caracteres — SEMPRE espelhar o `max` do schema da API. */
  maximo?: number;
  /** Campo de uma linha (códigos, ids) em vez de textarea. */
  umaLinha?: boolean;
  placeholder?: string;
  rotuloConfirmar?: string;
  /** Pinta a confirmação de vermelho (ação destrutiva/excepcional). */
  perigo?: boolean;
};

export type OpcoesConfirmar = {
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  perigo?: boolean;
};

type DialogosBridge = {
  pedirTexto: ((opcoes: OpcoesPedirTexto) => Promise<string | null>) | null;
  confirmar: ((opcoes: OpcoesConfirmar) => Promise<boolean>) | null;
};

const bridge: DialogosBridge = { pedirTexto: null, confirmar: null };

/** Registra o host React. Só uso interno (`DialogosHost`). */
export function registrarDialogos(parcial: Partial<DialogosBridge>) {
  Object.assign(bridge, parcial);
}

/**
 * Coleta um texto (justificativa, motivo, código) num modal com contador de
 * caracteres e validação de mínimo/máximo. Resolve `null` no cancelamento e
 * `''` quando o campo é opcional e ficou vazio.
 */
export async function pedirTexto(
  opcoes: OpcoesPedirTexto,
): Promise<string | null> {
  if (bridge.pedirTexto) return bridge.pedirTexto(opcoes);
  // Host não montado (não deve acontecer nas telas autenticadas).
  const bruto = window.prompt(
    `${opcoes.titulo}\n\n${opcoes.mensagem ?? ''}`.trim(),
  );
  if (bruto === null) return null;
  return bruto.trim();
}

/** Confirmação de ação num modal. Resolve `false` no cancelamento. */
export async function confirmarAcao(opcoes: OpcoesConfirmar): Promise<boolean> {
  if (bridge.confirmar) return bridge.confirmar(opcoes);
  return window.confirm(`${opcoes.titulo}\n\n${opcoes.mensagem}`);
}
