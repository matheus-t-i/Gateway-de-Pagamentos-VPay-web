'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ModalAcoes } from '@/components/modal';
import { useAuth } from '@/lib/auth';
import {
  ROTA_ATIVAR_2FA,
  registrarStepUpTotp,
} from '@/lib/step-up-totp-bridge';

/**
 * Host do modal "ative o 2FA". Montar uma vez dentro do AuthProvider.
 * Sincroniza `totpHabilitado` do auth com o bridge usado por `pedirCodigoTotp`.
 */
export function StepUpTotpHost() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

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
    });
    return () => {
      registrarStepUpTotp({
        totpHabilitado: null,
        abrirModalAtivar: () => {},
      });
    };
  }, [usuario, abrir]);

  function irAtivar(e: FormEvent) {
    e.preventDefault();
    setAberto(false);
    router.push(ROTA_ATIVAR_2FA);
  }

  return (
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
  );
}
