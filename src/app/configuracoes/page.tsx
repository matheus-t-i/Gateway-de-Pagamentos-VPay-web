'use client';

import { FormEvent, useState } from 'react';
import { Shell } from '@/components/shell';
import { TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type InicioTotp = { segredo: string; uri: string; qrCodeDataUrl: string };

function Seguranca() {
  const { token, usuario, refreshMe } = useAuth();
  const [inicio, setInicio] = useState<InicioTotp | null>(null);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [desativando, setDesativando] = useState(false);

  const ativo = usuario?.totpHabilitado ?? false;

  async function iniciar() {
    setErro(null);
    setOk(null);
    setLoading(true);
    try {
      setInicio(await api<InicioTotp>('/auth/totp/iniciar', { token: token!, method: 'POST' }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao iniciar');
    } finally {
      setLoading(false);
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await api('/auth/totp/confirmar', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigo }),
      });
      setInicio(null);
      setCodigo('');
      setOk('Verificação em duas etapas ativada.');
      await refreshMe();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setLoading(false);
    }
  }

  async function desabilitar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await api('/auth/totp/desabilitar', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ senha, codigo: codigo || undefined }),
      });
      setSenha('');
      setCodigo('');
      setDesativando(false);
      setOk('Verificação em duas etapas desativada.');
      await refreshMe();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desativar');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900';

  return (
    <section className="mt-8 max-w-md rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Verificação em duas etapas (2FA)</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            ativo
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-ink-800/10 opacity-70 dark:bg-white/10'
          }`}
        >
          {ativo ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      <p className="mt-2 text-sm opacity-70">
        Protege sua conta pedindo um código do aplicativo autenticador além da
        senha.
      </p>

      {ok && <p className="mt-3 text-sm text-emerald-600">{ok}</p>}
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {/* Ativação */}
      {!ativo && !inicio && (
        <button
          type="button"
          onClick={iniciar}
          disabled={loading}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Gerando…' : 'Ativar 2FA'}
        </button>
      )}

      {!ativo && inicio && (
        <form onSubmit={confirmar} className="mt-4 space-y-3">
          <p className="text-sm">
            1. Leia o QR Code no seu aplicativo autenticador (Google
            Authenticator, Authy, 1Password…).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inicio.qrCodeDataUrl}
            alt="QR Code para configurar a verificação em duas etapas"
            className="h-44 w-44 rounded bg-white p-2"
          />
          <p className="text-xs opacity-70">
            Não consegue ler? Digite este código no app:
            <br />
            <code className="mt-1 inline-block break-all font-mono text-xs">
              {inicio.segredo}
            </code>
          </p>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>2. Digite o código de 6 dígitos gerado</TextoRotulo>
            <input
              className={`${inputCls} text-center font-mono text-lg tracking-[0.4em]`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || codigo.length !== 6}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {loading ? 'Confirmando…' : 'Confirmar e ativar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setInicio(null);
                setCodigo('');
              }}
              className="rounded-md border border-ink-800/15 px-4 py-2 text-sm dark:border-white/15"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Desativação */}
      {ativo && !desativando && (
        <button
          type="button"
          onClick={() => setDesativando(true)}
          className="mt-4 rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600"
        >
          Desativar 2FA
        </button>
      )}

      {ativo && desativando && (
        <form onSubmit={desabilitar} className="mt-4 space-y-3">
          <p className="text-sm opacity-70">
            Para desativar, confirme sua senha. Se ainda tiver o aplicativo,
            informe também o código.
          </p>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Senha</TextoRotulo>
            <input
              className={inputCls}
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Código (opcional)
            <input
              className={inputCls}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? 'Desativando…' : 'Confirmar desativação'}
            </button>
            <button
              type="button"
              onClick={() => setDesativando(false)}
              className="rounded-md border border-ink-800/15 px-4 py-2 text-sm dark:border-white/15"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function ConfigPage() {
  const { usuario, patchTema } = useAuth();
  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm opacity-70">Perfil, aparência e segurança da conta.</p>

      <section className="mt-8 max-w-md space-y-4 rounded-lg border border-ink-800/10 p-4 dark:border-white/10">
        <h2 className="font-semibold">Perfil</h2>
        <p className="text-sm">
          <span className="opacity-60">Nome:</span> {usuario?.nomeRazaoSocial}
        </p>
        <p className="text-sm">
          <span className="opacity-60">E-mail:</span> {usuario?.email}
        </p>
        <div>
          <p className="text-sm opacity-60">Tema</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['PADRAO', 'CLARO', 'ESCURO'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => void patchTema(t)}
                className={`rounded border px-3 py-1.5 text-sm ${
                  usuario?.temaPreferido === t
                    ? 'border-accent text-accent'
                    : 'border-ink-800/20 dark:border-white/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Seguranca />
    </Shell>
  );
}
