'use client';

import { Shell } from '@/components/shell';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FILAS = [
  ['1-pix-webhook-received', 'Webhook cash-in da adquirente'],
  ['2-pix-webhook-send', 'Callback ao lojista'],
  ['3-pix-webhook-received-cashout', 'Webhook cash-out da adquirente'],
  ['4-pix-cash-out', 'Processamento de saque'],
  ['5-outbox-publisher', 'Publicação de eventos outbox'],
  ['6-liberacao-saldo', 'Liberações de saldo agendadas'],
  ['7-conciliacao', 'Conciliação periódica com a adquirente'],
] as const;

export default function FilasPage() {
  const { token } = useAuth();
  // Bull Board roda na API (fora do prefixo /api).
  const bullBoardUrl = API_URL.replace(/\/api$/, '') + '/admin/queues';

  // O Bull Board autentica por cookie `access_token` OU header Authorization.
  // O JWT fica em localStorage (não em cookie) e uma navegação top-level não
  // manda header — então plantamos o cookie antes de abrir. Cookie é escopado
  // por host (localhost), não por porta, então chega à API. Em produção, com
  // web e API em domínios distintos, o acesso ao Bull Board precisa de outro
  // mecanismo (cookie httpOnly emitido pela própria API ou IP allowlist).
  function abrirBullBoard() {
    if (token) {
      document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
    }
    window.open(bullBoardUrl, '_blank', 'noopener');
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Filas</h1>
      <p className="mt-1 text-sm opacity-70">
        Monitoramento dos jobs BullMQ (webhooks, saques, liberações,
        conciliação).
      </p>

      <div className="mt-6 rounded-lg border border-ink-800/10 p-4 text-sm dark:border-white/10">
        <p>
          O painel completo (jobs, falhas, retentativas) é o <strong>Bull Board</strong>,
          protegido por papel ADMINISTRADOR:
        </p>
        <button
          type="button"
          onClick={abrirBullBoard}
          className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Abrir Bull Board
        </button>
        <p className="mt-2 text-xs opacity-60">
          O acesso usa seu token de administrador (enviado via cookie
          access_token ao abrir).
        </p>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide opacity-60">
        Filas do sistema
      </h2>
      <ul className="mt-3 space-y-2">
        {FILAS.map(([nome, uso]) => (
          <li
            key={nome}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800/10 px-4 py-3 dark:border-white/10"
          >
            <span className="font-mono text-sm">{nome}</span>
            <span className="text-xs opacity-60">{uso}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
