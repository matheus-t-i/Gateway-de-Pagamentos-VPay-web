'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Marca } from '@/components/marca';
import { TextoRotulo } from '@/components/obrigatorio';
import { api, apiUpload } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import {
  lerCredsOnboarding,
  limparCredsOnboarding,
  salvarCredsOnboarding,
  type OnboardingCreds,
} from '@/lib/onboarding';

type DocsStatus = {
  enviados: Array<{
    tipoDocumento: string;
    situacao: string;
    nomeArquivo: string;
    motivoInvalidacao: string | null;
  }>;
  faltantes: string[];
};

type Status = {
  situacao: string;
  tipoPessoa: 'PF' | 'PJ';
  /** Pessoais (PF/responsável) e, para PJ, também os da pessoa jurídica. */
  documentos: DocsStatus;
};

const ROTULOS: Record<string, string> = {
  RG_CNH_FRENTE: 'Foto da frente do RG ou CNH',
  RG_CNH_VERSO: 'Foto do verso do RG ou CNH',
  SELFIE_COM_DOCUMENTO: 'Selfie segurando o RG ou CNH',
  CONTRATO_SOCIAL: 'Contrato social',
  CARTAO_CNPJ: 'Cartão CNPJ',
  COMPROVANTE_ENDERECO_EMPRESA: 'Comprovante de endereço da pessoa jurídica',
  CONTRATO_PRESTACAO_SERVICO: 'Contrato de prestação de serviço',
};

const rotulo = (t: string) => ROTULOS[t] ?? t;

const badgeCls: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  VALIDO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  INVALIDO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

function LinhaUpload({
  tipo,
  onEnviar,
  enviando,
}: {
  tipo: string;
  onEnviar: (tipo: string, arquivo: File) => Promise<void>;
  enviando: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-800/10 px-4 py-3 dark:border-white/10">
      <span className="text-sm font-medium">{rotulo(tipo)}</span>
      <label className="cursor-pointer rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:opacity-90">
        {enviando === tipo ? 'Enviando…' : 'Selecionar arquivo'}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={enviando !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onEnviar(tipo, f);
            e.target.value = '';
          }}
        />
      </label>
    </li>
  );
}

export default function OnboardingDocumentosPage() {
  const [creds, setCreds] = useState<OnboardingCreds | null>(null);
  const [credsForm, setCredsForm] = useState({ email: '', senha: '' });
  const [status, setStatus] = useState<Status | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarStatus = useCallback(async (c: OnboardingCreds) => {
    const s = await api<Status>('/onboarding/status', {
      method: 'POST',
      body: JSON.stringify(c),
    });
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    const saved = lerCredsOnboarding();
    if (!saved) {
      setCarregando(false);
      return;
    }
    setCreds(saved);
    carregarStatus(saved)
      .catch((e) => {
        // Credencial guardada ficou inválida (ex.: conta já aprovada). Volta ao
        // formulário de identificação com o erro — sem isto a tela fica em branco.
        setErro(e instanceof Error ? e.message : 'Falha ao carregar');
        limparCredsOnboarding();
        setCreds(null);
        setStatus(null);
      })
      .finally(() => setCarregando(false));
  }, [carregarStatus]);

  async function onIdentificar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await carregarStatus(credsForm);
      salvarCredsOnboarding(credsForm);
      setCreds(credsForm);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setCarregando(false);
    }
  }

  async function enviar(tipo: string, arquivo: File) {
    if (!creds) return;
    setErro(null);
    setEnviando(tipo);
    try {
      const fd = new FormData();
      fd.append('email', creds.email);
      fd.append('senha', creds.senha);
      fd.append('tipoDocumento', tipo);
      fd.append('arquivo', arquivo);
      const s = await apiUpload<Status>('/onboarding/documentos', fd);
      setStatus(s);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no envio');
    } finally {
      setEnviando(null);
    }
  }

  const tudoEnviado = status && status.documentos.faltantes.length === 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 sm:px-6">
      <Marca href="/login" prioridade />
      <h1 className="mt-3 font-display text-3xl font-semibold">
        Envio de documentação
      </h1>

      {carregando && <p className="mt-6 text-sm opacity-70">Carregando…</p>}

      {/* Sem credenciais na sessão: pedir identificação */}
      {!carregando && !creds && (
        <form onSubmit={onIdentificar} className="mt-8 max-w-md space-y-4">
          <p className="text-sm opacity-70">
            Identifique-se com o e-mail e a senha do cadastro para continuar o
            envio dos documentos.
          </p>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>E-mail</TextoRotulo>
            <input
              className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
              type="email"
              value={credsForm.email}
              onChange={(e) => setCredsForm((c) => ({ ...c, email: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Senha</TextoRotulo>
            <input
              className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
              type="password"
              value={credsForm.senha}
              onChange={(e) => setCredsForm((c) => ({ ...c, senha: e.target.value }))}
              required
            />
          </label>
          {erro && (
            <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">{erro}</p>
              {/* Esta tela é para quem AINDA não tem acesso. Conta já aprovada
                  (ou reprovada) cai aqui sem ter para onde ir — o caminho de
                  volta precisa estar visível junto do erro. */}
              <Link
                href="/login"
                className="mt-1.5 inline-block text-sm font-medium text-red-700 underline dark:text-red-300"
              >
                Ir para a tela de login
              </Link>
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground transition hover:opacity-90"
          >
            Continuar
          </button>
          <p className="text-center text-sm opacity-70">
            Já tem acesso?{' '}
            <Link href="/login" className="font-medium text-accent underline">
              Entrar na conta
            </Link>
          </p>
        </form>
      )}

      {!carregando && creds && status && (
        <>
          {tudoEnviado ? (
            <div className="mt-8 rounded-xl border border-emerald-400/40 bg-emerald-50 p-6 dark:bg-emerald-950/30">
              <h2 className="font-display text-xl font-semibold text-emerald-800 dark:text-emerald-300">
                Documentação completa — conta em análise
              </h2>
              <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                Recebemos todos os documentos obrigatórios. Nossa equipe vai
                analisar seu cadastro e você será avisado por e-mail. Depois da
                aprovação, é só{' '}
                <Link href="/login" className="font-medium underline">
                  acessar sua conta
                </Link>
                .
              </p>
              <p className="mt-3 text-xs text-emerald-900/60 dark:text-emerald-200/60">
                Dúvidas: {BRAND.email} · WhatsApp {BRAND.whatsapp}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-70">
              {status.tipoPessoa === 'PJ'
                ? 'Envie os documentos do responsável e da pessoa jurídica (PDF, JPG ou PNG, até 10MB).'
                : 'Envie seus documentos pessoais (PDF, JPG ou PNG, até 10MB).'}{' '}
              Quando todos forem recebidos sua conta entra em análise
              automaticamente.
            </p>
          )}

          {/* Documentos da conta — titular (PF) ou responsável + PJ */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              {status.tipoPessoa === 'PJ'
                ? 'Documentos do responsável e da empresa'
                : 'Documentos do titular'}
            </h2>
            {status.documentos.enviados.length > 0 && (
              <ul className="mt-3 space-y-2">
                {status.documentos.enviados.map((d, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800/10 px-4 py-2.5 text-sm dark:border-white/10"
                  >
                    <span>{rotulo(d.tipoDocumento)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls[d.situacao] ?? ''}`}
                    >
                      {d.situacao}
                      {d.motivoInvalidacao ? ` — ${d.motivoInvalidacao}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {status.documentos.faltantes.length > 0 && (
              <ul className="mt-3 space-y-2">
                {status.documentos.faltantes.map((t) => (
                  <LinhaUpload
                    key={t}
                    tipo={t}
                    enviando={enviando}
                    onEnviar={(tipo, f) => enviar(tipo, f)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Slot do contrato de prestação de serviço — enviado pela VPay */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              Contrato
            </h2>
            <p className="mt-2 rounded-lg border border-dashed border-ink-800/20 px-4 py-3 text-sm opacity-80 dark:border-white/20">
              O contrato de prestação de serviço é enviado pela {BRAND.nome} aqui
              após a assinatura. Quando disponível, ele aparece na lista de
              documentos acima.
            </p>
          </section>

          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

          <button
            type="button"
            onClick={() => {
              limparCredsOnboarding();
              setCreds(null);
              setStatus(null);
            }}
            className="mt-10 self-start text-xs opacity-60 underline hover:opacity-100"
          >
            Sair do envio de documentos
          </button>
        </>
      )}
    </main>
  );
}
