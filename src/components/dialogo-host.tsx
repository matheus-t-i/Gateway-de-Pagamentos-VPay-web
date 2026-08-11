'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ModalAcoes } from '@/components/modal';
import {
  OpcoesConfirmar,
  OpcoesPedirTexto,
  registrarDialogos,
} from '@/lib/dialogos';

type PedidoTexto = OpcoesPedirTexto & {
  resolver: (valor: string | null) => void;
};
type PedidoConfirmacao = OpcoesConfirmar & {
  resolver: (ok: boolean) => void;
};

const areaTexto =
  'mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40';

/**
 * Host dos diálogos de texto/confirmação (`pedirTexto`/`confirmarAcao`).
 * Montar uma vez, junto do StepUpTotpHost. Substitui `window.prompt`/`confirm`:
 * modal sobrevive à troca de aplicativo no celular, mostra contador de
 * caracteres e trava mínimo/máximo IGUAIS aos do schema da API — o prompt
 * nativo aceitava qualquer coisa e o erro só aparecia depois do 2FA.
 */
export function DialogosHost() {
  const [texto, setTexto] = useState<PedidoTexto | null>(null);
  const [valor, setValor] = useState('');
  const [confirmacao, setConfirmacao] = useState<PedidoConfirmacao | null>(null);
  const campoRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const pedirTexto = useCallback((opcoes: OpcoesPedirTexto) => {
    return new Promise<string | null>((resolve) => {
      setValor('');
      setTexto((anterior) => {
        anterior?.resolver(null);
        return { ...opcoes, resolver: resolve };
      });
    });
  }, []);

  const confirmar = useCallback((opcoes: OpcoesConfirmar) => {
    return new Promise<boolean>((resolve) => {
      setConfirmacao((anterior) => {
        anterior?.resolver(false);
        return { ...opcoes, resolver: resolve };
      });
    });
  }, []);

  useEffect(() => {
    registrarDialogos({ pedirTexto, confirmar });
    return () => registrarDialogos({ pedirTexto: null, confirmar: null });
  }, [pedirTexto, confirmar]);

  useEffect(() => {
    if (texto) campoRef.current?.focus();
  }, [texto]);

  const minimo = texto?.minimo ?? 0;
  const maximo = texto?.maximo ?? 500;
  const tamanho = valor.trim().length;
  const faltam = Math.max(0, minimo - tamanho);
  const valido = tamanho >= minimo;

  function confirmarTexto(e: FormEvent) {
    e.preventDefault();
    if (!texto || !valido) return;
    texto.resolver(valor.trim());
    setTexto(null);
    setValor('');
  }

  function cancelarTexto() {
    texto?.resolver(null);
    setTexto(null);
    setValor('');
  }

  function responderConfirmacao(ok: boolean) {
    confirmacao?.resolver(ok);
    setConfirmacao(null);
  }

  return (
    <>
      <Modal
        open={!!texto}
        onClose={cancelarTexto}
        title={texto?.titulo ?? ''}
      >
        <form onSubmit={confirmarTexto} className="space-y-3">
          {texto?.mensagem && (
            <p className="whitespace-pre-line text-sm leading-relaxed opacity-80">
              {texto.mensagem}
            </p>
          )}
          <label className="block text-sm">
            {texto?.rotulo ??
              (minimo > 0 ? 'Justificativa' : 'Motivo (opcional)')}
            {texto?.umaLinha ? (
              <input
                ref={campoRef}
                className={areaTexto}
                value={valor}
                onChange={(e) => setValor(e.target.value.slice(0, maximo))}
                maxLength={maximo}
                placeholder={texto?.placeholder}
              />
            ) : (
              <textarea
                ref={campoRef}
                className={`${areaTexto} resize-y`}
                rows={3}
                value={valor}
                onChange={(e) => setValor(e.target.value.slice(0, maximo))}
                maxLength={maximo}
                placeholder={texto?.placeholder}
              />
            )}
          </label>
          {/* Contador sempre visível: quanto falta para o mínimo enquanto não
              atinge, quanto resta do teto depois — o prompt nativo deixava a
              pessoa descobrir o limite só no erro da API. */}
          <p
            className={`text-right text-xs tabular-nums ${
              faltam > 0 ? 'text-amber-700 dark:text-amber-300' : 'opacity-55'
            }`}
            aria-live="polite"
          >
            {faltam > 0
              ? `faltam ${faltam} de ${minimo} caracteres mínimos`
              : `${valor.length}/${maximo}`}
          </p>
          <ModalAcoes
            onCancelar={cancelarTexto}
            rotulo={texto?.rotuloConfirmar ?? 'Confirmar'}
            desabilitado={!valido}
            tom={texto?.perigo ? 'perigo' : 'padrao'}
          />
        </form>
      </Modal>

      <Modal
        open={!!confirmacao}
        onClose={() => responderConfirmacao(false)}
        title={confirmacao?.titulo ?? ''}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            responderConfirmacao(true);
          }}
          className="space-y-4"
        >
          <p className="whitespace-pre-line text-sm leading-relaxed opacity-80">
            {confirmacao?.mensagem}
          </p>
          <ModalAcoes
            onCancelar={() => responderConfirmacao(false)}
            rotulo={confirmacao?.rotuloConfirmar ?? 'Confirmar'}
            tom={confirmacao?.perigo ? 'perigo' : 'padrao'}
          />
        </form>
      </Modal>
    </>
  );
}
