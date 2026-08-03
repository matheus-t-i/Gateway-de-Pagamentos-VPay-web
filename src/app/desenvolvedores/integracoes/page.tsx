'use client';

import Link from 'next/link';
import { Shell } from '@/components/shell';
import { API_URL } from '@/lib/api';
import { BRAND } from '@/lib/brand';

const PASSOS = [
  {
    titulo: '1. Crie uma chave de API',
    texto: 'Em Desenvolvedores → Chaves de API, gere o par x-api-key / x-api-secret. O segredo aparece uma única vez.',
    href: '/desenvolvedores/chaves',
  },
  {
    titulo: '2. Configure seus webhooks',
    texto: 'Cadastre a URL do seu sistema para receber callbacks de liquidação e saque em tempo real.',
    href: '/desenvolvedores/webhooks',
  },
  {
    titulo: '3. Crie sua primeira cobrança',
    texto: 'Use a API PIX para gerar cobranças com QR Code e acompanhar o status de ponta a ponta.',
    href: '/desenvolvedores/documentacao',
  },
];

export default function IntegracoesPage() {
  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Integrações</h1>
      <p className="mt-1 text-sm opacity-70">
        Tudo que você precisa para conectar seu sistema ao {BRAND.nome}.
      </p>

      <div className="mt-8 rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
        <p className="text-xs uppercase tracking-wide opacity-60">Base URL da API</p>
        <p className="mt-1 break-all font-mono text-sm">{API_URL}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PASSOS.map((p) => (
          <Link
            key={p.titulo}
            href={p.href}
            className="rounded-lg border border-ink-800/10 p-4 transition hover:border-accent dark:border-white/10"
          >
            <p className="font-medium">{p.titulo}</p>
            <p className="mt-2 text-sm opacity-70">{p.texto}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-ink-800/10 p-4 text-sm dark:border-white/10">
        <h2 className="font-semibold">Precisa de ajuda?</h2>
        <p className="mt-2 opacity-80">
          Suporte técnico: <a className="text-accent underline" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
          {' · '}
          WhatsApp:{' '}
          <a className="text-accent underline" href={BRAND.whatsappLink} target="_blank" rel="noreferrer">
            {BRAND.whatsapp}
          </a>
          {' · '}
          Site:{' '}
          <a className="text-accent underline" href={BRAND.site} target="_blank" rel="noreferrer">
            {BRAND.site}
          </a>
        </p>
      </div>
    </Shell>
  );
}
