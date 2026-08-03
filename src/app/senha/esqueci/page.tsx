'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BRAND } from '@/lib/brand';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      await api('/auth/senha/esqueci', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao solicitar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <p className="font-display text-4xl font-semibold text-accent">{BRAND.nome}</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">Esqueci minha senha</h1>

      {enviado ? (
        <div className="mt-6 rounded-lg border border-emerald-400/40 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Verifique seu e-mail
          </p>
          <p className="mt-2 text-emerald-900/80 dark:text-emerald-200/80">
            Se este e-mail estiver cadastrado, enviamos um link para criar uma
            nova senha. O link vale por 30 minutos.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-accent underline"
          >
            Voltar para o login
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm opacity-70">
            Informe o e-mail da conta. Enviaremos um link para criar uma nova
            senha.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              E-mail
              <input
                className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Enviar link de redefinição'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm opacity-80">
            Lembrou a senha?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Acessar
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
