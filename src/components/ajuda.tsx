'use client';

import { CircleHelp } from 'lucide-react';

/**
 * Ícone de ajuda ao lado do rótulo — hover/focus abre o texto completo.
 * Usado nos formulários densos do admin (conta, taxas, retenções…).
 */
export function Ajuda({ texto }: { texto: string }) {
  return (
    <span className="group/ajuda relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label="Ajuda"
        className="rounded-full p-0.5 text-ink-800/45 outline-none transition hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-white/40 dark:hover:text-amber-400"
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.4rem)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg border border-ink-800/15 bg-ink-950 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition group-hover/ajuda:opacity-100 group-focus-within/ajuda:opacity-100 dark:border-white/15 dark:bg-ink-900 sm:w-72"
      >
        {texto}
      </span>
    </span>
  );
}
