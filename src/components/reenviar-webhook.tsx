'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Reenvia o callback de uma transação. O job entra na fila dedicada
 * `11-webhook-reenvio` — é só uma nova ENTREGA do evento que já existe, nada é
 * creditado nem movimentado de novo.
 *
 * `escopo` decide o endpoint: `admin` alcança qualquer conta (suporte),
 * `painel` só a conta do próprio JWT.
 */
export function BotaoReenviarWebhook({
  idTransacao,
  escopo,
}: {
  idTransacao: string;
  escopo: 'admin' | 'painel';
}) {
  const { token } = useAuth();
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  const caminho =
    escopo === 'admin'
      ? `/admin/relatorios/transacoes/${idTransacao}/reenviar-webhook`
      : `/painel/transacoes/${idTransacao}/reenviar-webhook`;

  const reenviar = useMutation({
    mutationFn: () => api<{ ok: boolean }>(caminho, { method: 'POST', token: token! }),
    onMutate: () => {
      setErro('');
      setOk(false);
    },
    onSuccess: () => {
      setOk(true);
      // Some sozinho: é confirmação de enfileiramento, não estado permanente.
      setTimeout(() => setOk(false), 4000);
    },
    onError: (e: Error) => setErro(mensagemDoErro(e.message)),
  });

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => reenviar.mutate()}
        disabled={reenviar.isPending}
        title="Reenviar o callback desta transação"
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-800/15 px-2.5 py-1 text-xs font-medium transition hover:bg-ink-800/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${reenviar.isPending ? 'animate-spin' : ''}`}
          strokeWidth={1.75}
        />
        {reenviar.isPending ? 'Reenviando…' : 'Reenviar'}
      </button>
      {ok && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Reenvio enfileirado.
        </span>
      )}
      {erro && (
        <span className="max-w-[16rem] text-xs text-red-600 dark:text-red-400" title={erro}>
          {erro}
        </span>
      )}
    </div>
  );
}

/** A API devolve o corpo do erro cru; extrai a mensagem legível quando é JSON. */
function mensagemDoErro(texto: string): string {
  try {
    const json = JSON.parse(texto) as { message?: string | string[] };
    const m = json.message;
    if (Array.isArray(m)) return m.join('; ');
    if (m) return m;
  } catch {
    /* corpo não-JSON: usa o texto como veio */
  }
  return texto || 'Falha ao reenviar.';
}
