'use client';

import { ReactNode, useEffect } from 'react';

/**
 * Modal mobile-first: no celular sobe de baixo (bottom sheet), no desktop
 * centraliza. Fecha no ESC, no backdrop e no X.
 */
const LARGURAS = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  largura = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** `lg`/`xl` para formulários largos (ex.: matriz de permissões). */
  largura?: keyof typeof LARGURAS;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[90vh] w-full ${LARGURAS[largura]} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-ink-900 sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none opacity-60 hover:opacity-100"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Rodapé padrão de modal/formulário: Cancelar à ESQUERDA, ação primária à
 * DIREITA. A ação primária é type="submit" (dispara o onSubmit do form).
 */
export function ModalAcoes({
  onCancelar,
  rotulo = 'Salvar',
  pendente,
  desabilitado,
}: {
  onCancelar: () => void;
  rotulo?: string;
  pendente?: boolean;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pendente || desabilitado}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {pendente ? 'Salvando…' : rotulo}
      </button>
    </div>
  );
}
