'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Marca } from '@/components/marca';
import { TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import {
  lerCredsOnboarding,
  limparCredsOnboarding,
  type OnboardingCreds,
} from '@/lib/onboarding';
import { REGRAS_SENHA } from '@/lib/senha';

const input =
  'mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-900';

function Regra({ texto, ok, neutro }: { texto: string; ok: boolean; neutro: boolean }) {
  return (
    <li
      className={`flex items-start gap-1.5 text-xs ${
        neutro
          ? 'opacity-55'
          : ok
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
      }`}
    >
      {neutro ? (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      ) : ok ? (
        <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <X className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      )}
      <span>{texto}</span>
    </li>
  );
}

/**
 * Troca obrigatória da senha provisória gerada pelo administrador.
 *
 * Sem JWT de propósito: a conta nesse estado não recebe token no login. As
 * credenciais vêm da mesma gaveta do onboarding (sessionStorage, some ao fechar
 * a aba) — e o formulário aceita digitá-las de novo se a pessoa abriu a página
 * direto.
 */
export default function TrocarSenhaObrigatoriaPage() {
  const router = useRouter();
  const [creds, setCreds] = useState<OnboardingCreds>({ email: '', senha: '' });
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const salvo = lerCredsOnboarding();
    if (salvo) setCreds(salvo);
  }, []);

  const iguais = novaSenha.length > 0 && novaSenha === confirmacao;
  const regrasOk = REGRAS_SENHA.every((r) => r.ok(novaSenha));
  const pode = !!creds.email && !!creds.senha && regrasOk && iguais;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api('/auth/senha/trocar-obrigatoria', {
        method: 'POST',
        body: JSON.stringify({
          email: creds.email,
          senhaAtual: creds.senha,
          novaSenha,
          confirmacaoNovaSenha: confirmacao,
        }),
      });
      limparCredsOnboarding();
      setOk(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao trocar a senha');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <Marca href="/login" prioridade />
      <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
        Crie uma nova senha
      </h1>

      {ok ? (
        <div className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-50 p-5 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Senha alterada.
          </p>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
            Redirecionando para o login…{' '}
            <Link href="/login" className="underline">
              entrar agora
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            Sua senha foi redefinida pelo administrador. Para continuar, troque a
            senha provisória por uma sua.
          </p>

          <label className="block text-sm">
            <TextoRotulo obrigatorio>E-mail</TextoRotulo>
            <input
              className={input}
              type="email"
              value={creds.email}
              onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Senha provisória</TextoRotulo>
            <input
              className={input}
              type="password"
              value={creds.senha}
              onChange={(e) => setCreds((c) => ({ ...c, senha: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Nova senha</TextoRotulo>
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Confirmação da nova senha</TextoRotulo>
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
            />
          </label>

          <ul className="space-y-1 rounded-xl bg-ink-800/[0.03] p-3 dark:bg-white/[0.03]">
            {REGRAS_SENHA.map((r) => (
              <Regra
                key={r.id}
                texto={r.texto}
                ok={r.ok(novaSenha)}
                neutro={novaSenha.length === 0}
              />
            ))}
            <Regra
              texto="As senhas informadas precisam ser iguais"
              ok={iguais}
              neutro={confirmacao.length === 0}
            />
          </ul>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={!pode || enviando}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : 'Salvar e continuar'}
          </button>

          <p className="text-center text-sm opacity-70">
            <Link href="/login" className="underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
