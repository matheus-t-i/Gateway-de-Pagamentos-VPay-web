'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Marca } from '@/components/marca';
import { TextoRotulo } from '@/components/obrigatorio';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { salvarCredsOnboarding } from '@/lib/onboarding';

const DESTAQUES = [
  {
    icone: '🔒',
    titulo: 'Segurança Enterprise',
    texto: 'Criptografia de ponta a ponta',
  },
  {
    icone: '⚡',
    titulo: 'Processamento Rápido',
    texto: 'Transações instantâneas via PIX',
  },
  {
    icone: '📊',
    titulo: 'Relatórios Completos',
    texto: 'Análise detalhada em tempo real',
  },
];

export default function LoginPage() {
  const { login, token, hidratando } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoTotp, setCodigoTotp] = useState('');
  const [precisa2FA, setPrecisa2FA] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hidratando && token) {
      router.replace('/dashboard');
    }
  }, [hidratando, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await login(email, senha, codigoTotp);
      // Conta com 2FA: pede o código antes de qualquer token.
      if (res.requer2FA) {
        // O texto de apoio do próprio campo já explica o que fazer; usar o
        // bloco de "aviso" aqui traria o texto de conta em análise, que é outro
        // contexto.
        setPrecisa2FA(true);
        return;
      }
      // Antes do teste de ATIVO: a conta com senha provisória responde
      // `situacao: ATIVO` mas SEM token — cair no /dashboard aqui só devolveria
      // o usuário para o login pelo guarda do Shell.
      if (res.requerTrocaSenha) {
        salvarCredsOnboarding({ email, senha });
        router.push('/senha/trocar');
        return;
      }
      if (res.situacao === 'ATIVO') {
        router.push('/dashboard');
        return;
      }
      if (res.proximoPasso === 'ENVIAR_DOCUMENTOS') {
        // Conta aguardando documentação → leva direto para a tela de envio.
        salvarCredsOnboarding({ email, senha });
        router.push('/onboarding/documentos');
        return;
      }
      if (res.situacao === 'EM_ANALISE') {
        setAviso(res.mensagem ?? 'Sua conta está em análise.');
        return;
      }
      setErro(
        res.mensagem ??
          (res.motivo
            ? `Cadastro reprovado: ${res.motivo}`
            : 'Conta não habilitada para acesso.'),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Painel institucional (esquerda) — somente desktop; no celular o login
          vem primeiro e este painel não aparece (mobile-first). */}
      <section className="hidden flex-col justify-between bg-ink-950 px-8 py-10 text-sand-50 lg:flex lg:min-h-screen lg:w-1/2 lg:px-16 lg:py-16">
        <div>
          <Marca
            fundo="escuro"
            href={null}
            prioridade
            className="mb-1 w-full justify-center"
            imagemClassName="h-20 w-auto max-w-[18rem] object-contain object-center lg:h-24 lg:max-w-[22rem] xl:h-28 xl:max-w-[26rem]"
          />
          <h1 className="mt-10 font-display text-3xl font-semibold leading-tight lg:text-5xl">
            Acesso seguro ao seu gateway de pagamentos
          </h1>
          <p className="mt-4 max-w-md text-sm opacity-70 lg:text-base">
            Gerencie saldos, transações e status do sistema com monitoramento em
            tempo real e segurança de nível empresarial.
          </p>
          <ul className="mt-10 space-y-6">
            {DESTAQUES.map((d) => (
              <li key={d.titulo} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl">
                  {d.icone}
                </span>
                <div>
                  <p className="font-medium">{d.titulo}</p>
                  <p className="text-sm opacity-60">{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-12 border-t border-white/10 pt-6 text-xs opacity-50">
          © {new Date().getFullYear()} {BRAND.nome} — Todos os direitos reservados
        </p>
      </section>

      {/* Card de login (direita; no celular é a tela toda) */}
      <section className="flex flex-1 flex-col items-center justify-center bg-sand-50 px-4 py-10 dark:bg-ink-900 sm:px-6 lg:min-h-screen">
        {/* Marca — apenas mobile (desktop usa o painel institucional) */}
        <Marca
          href={null}
          prioridade
          className="mb-6 w-full justify-center lg:hidden"
          imagemClassName="h-14 w-auto max-w-[16rem] object-contain object-center sm:h-16 sm:max-w-[18rem]"
        />
        <div className="w-full max-w-md rounded-2xl border border-ink-800/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-ink-950 sm:p-8">
          <h2 className="text-center font-display text-3xl font-semibold">
            Acessar Conta
          </h2>
          <p className="mt-2 text-center text-sm opacity-70">
            Entre com suas credenciais para acessar o painel
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>E-mail</TextoRotulo>
              <input
                className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="seu@email.com"
                required
              />
            </label>
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Senha</TextoRotulo>
              <input
                className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </label>
            {precisa2FA && (
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Código de verificação (2FA)</TextoRotulo>
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.4em] dark:border-white/10 dark:bg-ink-900"
                  value={codigoTotp}
                  onChange={(e) =>
                    setCodigoTotp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                />
                <span className="mt-1 block text-xs opacity-60">
                  Abra seu aplicativo autenticador e digite o código de 6 dígitos.
                </span>
              </label>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {aviso && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {aviso} Avisaremos por e-mail quando a análise terminar. Dúvidas:{' '}
                <a className="underline" href={`mailto:${BRAND.email}`}>
                  {BRAND.email}
                </a>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Entrando…' : precisa2FA ? 'Confirmar código' : 'Acessar'}
            </button>
            <p className="text-center text-sm">
              <Link
                href="/senha/esqueci"
                className="text-accent hover:underline"
              >
                Esqueci minha senha
              </Link>
            </p>
          </form>
          <p className="mt-6 border-t border-ink-800/10 pt-5 text-center text-sm opacity-80 dark:border-white/10">
            Não tem uma conta?{' '}
            <Link href="/cadastro" className="font-medium text-accent hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
