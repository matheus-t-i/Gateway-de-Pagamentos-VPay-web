'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Modal, ModalAcoes } from '@/components/modal';
import { useAuth } from '@/lib/auth';
import {
  ROTA_ATIVAR_2FA,
  registrarStepUpTotp,
} from '@/lib/step-up-totp-bridge';

/** Pedido de código em aberto: a promessa que o call site está aguardando. */
type PedidoCodigo = {
  mensagem?: string;
  resolver: (codigo: string | null) => void;
};

/**
 * Host dos modais de step-up TOTP. Montar uma vez dentro do AuthProvider.
 *
 * Dois modais: "ative o 2FA" (conta sem TOTP) e o coletor do código de 6
 * dígitos. O coletor substitui o `window.prompt`: no celular, sair para o
 * aplicativo autenticador descartava o prompt nativo e a pessoa voltava para
 * uma tela sem nada — com modal React, a janela e o formulário por trás
 * continuam exatamente onde estavam.
 */
export function StepUpTotpHost() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState<PedidoCodigo | null>(null);
  const [codigo, setCodigo] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  const pedirCodigo = useCallback((mensagem?: string) => {
    return new Promise<string | null>((resolve) => {
      setCodigo('');
      setPedido((anterior) => {
        // Pedido sobreposto (não deve acontecer): o antigo desiste em vez de
        // deixar um await pendurado para sempre.
        anterior?.resolver(null);
        return { mensagem, resolver: resolve };
      });
    });
  }, []);

  useEffect(() => {
    registrarStepUpTotp({
      // Só bloqueia cedo quando sabemos que está desligado; `undefined`
      // deixa pedir o código e o 403 da API abre o modal via `api()`.
      totpHabilitado:
        usuario == null
          ? null
          : typeof usuario.totpHabilitado === 'boolean'
            ? usuario.totpHabilitado
            : null,
      abrirModalAtivar: abrir,
      pedirCodigo,
    });
    return () => {
      registrarStepUpTotp({
        totpHabilitado: null,
        abrirModalAtivar: () => {},
        pedirCodigo: null,
      });
    };
  }, [usuario, abrir, pedirCodigo]);

  // Foco no campo quando o modal abre (autoFocus não basta: o modal monta
  // fechado e só depois recebe o pedido).
  useEffect(() => {
    if (pedido) inputRef.current?.focus();
  }, [pedido]);

  function irAtivar(e: FormEvent) {
    e.preventDefault();
    setAberto(false);
    router.push(ROTA_ATIVAR_2FA);
  }

  function confirmarCodigo(e: FormEvent) {
    e.preventDefault();
    if (!pedido || codigo.length !== 6) return;
    pedido.resolver(codigo);
    setPedido(null);
    setCodigo('');
  }

  function cancelarCodigo() {
    pedido?.resolver(null);
    setPedido(null);
    setCodigo('');
  }

  return (
    <>
      <Modal
        open={aberto}
        onClose={fechar}
        title="Verificação em duas etapas necessária"
      >
        <form onSubmit={irAtivar} className="space-y-4">
          <p className="text-sm leading-relaxed opacity-80">
            Esta operação exige autenticação em duas etapas (2FA) ativa na sua
            conta. Ative o autenticador em Configurações e tente de novo.
          </p>
          <ModalAcoes onCancelar={fechar} rotulo="Ativar 2FA" />
        </form>
      </Modal>

      <Modal
        open={!!pedido}
        onClose={cancelarCodigo}
        title="Confirmação em duas etapas"
      >
        <form onSubmit={confirmarCodigo} className="space-y-4">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed opacity-80">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              strokeWidth={2}
              aria-hidden
            />
            <span>
              {pedido?.mensagem ??
                'Para continuar, informe o código do seu aplicativo autenticador.'}
            </span>
          </p>
          <input
            ref={inputRef}
            className="w-full rounded-lg border border-ink-800/15 bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.4em] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            aria-label="Código de 6 dígitos do aplicativo autenticador"
            required
          />
          <p className="text-xs leading-relaxed opacity-55">
            Pode trocar para o aplicativo autenticador e voltar — esta janela e o
            que você preencheu continuam aqui.
          </p>
          <ModalAcoes
            onCancelar={cancelarCodigo}
            rotulo="Confirmar"
            desabilitado={codigo.length !== 6}
          />
        </form>
      </Modal>
    </>
  );
}
