'use client';

import {
  useEffect,
  useId,
  useRef,
  type MutableRefObject,
} from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __vpayTurnstileScriptPromise?: Promise<void>;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function carregarScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__vpayTurnstileScriptPromise) {
    return window.__vpayTurnstileScriptPromise;
  }
  window.__vpayTurnstileScriptPromise = new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/"]`,
    );
    if (existente) {
      existente.addEventListener('load', () => resolve(), { once: true });
      existente.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar Turnstile')),
        { once: true },
      );
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar Turnstile'));
    document.head.appendChild(s);
  });
  return window.__vpayTurnstileScriptPromise;
}

export type TurnstileHandle = {
  reset: () => void;
};

type Props = {
  onToken: (token: string | null) => void;
  /** Ref imperativa para resetar o widget após erro / 2FA. */
  handleRef?: MutableRefObject<TurnstileHandle | null>;
  className?: string;
};

/**
 * Widget Cloudflare Turnstile. Sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` não renderiza
 * (dev/CI) — o login da API também fica fail-open sem o secret.
 */
export function TurnstileWidget({ onToken, handleRef, className }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const hostId = useId().replace(/:/g, '');
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) {
      onTokenRef.current(null);
      return;
    }

    let cancelado = false;

    void (async () => {
      try {
        await carregarScript();
        if (cancelado || !window.turnstile) return;
        const el = document.getElementById(`cf-turnstile-${hostId}`);
        if (!el) return;
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
          theme: 'auto',
        });
      } catch {
        onTokenRef.current(null);
      }
    })();

    if (handleRef) {
      handleRef.current = {
        reset: () => {
          onTokenRef.current(null);
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      };
    }

    return () => {
      cancelado = true;
      if (handleRef) handleRef.current = null;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget já removido */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, hostId, handleRef]);

  if (!siteKey) return null;

  return (
    <div
      id={`cf-turnstile-${hostId}`}
      className={className ?? 'flex justify-center'}
    />
  );
}

/** true quando o front espera um token Turnstile no login. */
export function turnstileAtivoNoCliente(): boolean {
  return !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
}
