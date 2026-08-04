'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Marca } from '@/components/marca';
import { api } from '@/lib/api';

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/senha/redefinir', {
        method: 'POST',
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      setOk(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao redefinir');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-6 rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
        <p className="text-amber-900 dark:text-amber-200">
          Link inválido — o endereço não tem um código de redefinição.
        </p>
        <Link href="/senha/esqueci" className="mt-3 inline-block text-accent underline">
          Solicitar um novo link
        </Link>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="mt-6 rounded-lg border border-emerald-400/40 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">
          Senha alterada!
        </p>
        <p className="mt-2 text-emerald-900/80 dark:text-emerald-200/80">
          Redirecionando para o login…
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm opacity-70">Escolha uma nova senha para sua conta.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          Nova senha
          <input
            className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="block text-sm">
          Confirme a nova senha
          <input
            className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <p className="text-xs opacity-60">Mínimo de 8 caracteres.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <Marca href="/login" prioridade />
      <h1 className="mt-3 font-display text-2xl font-semibold">Criar nova senha</h1>
      <Suspense fallback={<p className="mt-6 text-sm opacity-70">Carregando…</p>}>
        <Formulario />
      </Suspense>
    </main>
  );
}
