'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Clock,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Shell } from '@/components/shell';
import { Modal, ModalAcoes } from '@/components/modal';
import { TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { REGRAS_SENHA } from '@/lib/senha';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type InicioTotp = { segredo: string; uri: string; qrCodeDataUrl: string };

const inputBase =
  'mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40';

const dataHora = (v: string | Date) =>
  new Date(v).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Cartão padrão da tela. Todas as seções usam a mesma moldura, cabeçalho com
 * ícone e espaçamento — antes cada bloco tinha a sua borda e largura própria e
 * a página virava uma pilha de caixas estreitas.
 */
function Cartao({
  icone: Icone,
  titulo,
  descricao,
  acessorio,
  children,
  perigo = false,
  className = '',
  id,
}: {
  icone: React.ElementType;
  titulo: string;
  descricao?: string;
  /** Selo e/ou ação principal, à direita do título. */
  acessorio?: React.ReactNode;
  /** Sem corpo, o cartão vira uma linha só — nada de área vazia sob o título. */
  children?: React.ReactNode;
  perigo?: boolean;
  className?: string;
  /** Âncora para deep-link (ex.: `#seguranca` no 2FA). */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-2xl border bg-white shadow-sm dark:bg-ink-900 ${
        perigo
          ? 'border-red-500/30 dark:border-red-500/25'
          : 'border-ink-800/10 dark:border-white/10'
      } ${className}`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 p-4 sm:p-5 ${
          children
            ? 'border-b border-ink-800/[0.07] dark:border-white/[0.07]'
            : ''
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              perigo
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-accent/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Icone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              className={`font-display text-base font-semibold leading-tight ${
                perigo ? 'text-red-700 dark:text-red-400' : ''
              }`}
            >
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-0.5 text-xs leading-relaxed opacity-60">{descricao}</p>
            )}
          </div>
        </div>
        {acessorio && (
          <div className="flex shrink-0 items-center gap-2">{acessorio}</div>
        )}
      </header>
      {children && <div className="p-4 sm:p-5">{children}</div>}
    </section>
  );
}

function Selo({
  children,
  tom,
}: {
  children: React.ReactNode;
  tom: 'ok' | 'neutro' | 'alerta';
}) {
  const cores = {
    ok: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
    alerta: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
    neutro: 'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10',
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cores[tom]}`}
    >
      {children}
    </span>
  );
}

/** Aviso de sucesso/erro dentro de um cartão. */
function Aviso({ tipo, children }: { tipo: 'ok' | 'erro'; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        tipo === 'ok'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-500/10 text-red-700 dark:text-red-300'
      }`}
    >
      {children}
    </p>
  );
}

/** Linha de regra atendida/não atendida. Neutra enquanto o campo está vazio. */
function Regra({ texto, ok, neutro }: { texto: string; ok: boolean; neutro: boolean }) {
  return (
    <li
      className={`flex items-start gap-1.5 text-xs leading-snug ${
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

const SITUACAO_TOM: Record<string, 'ok' | 'alerta' | 'neutro'> = {
  ATIVO: 'ok',
  PENDENTE: 'alerta',
  EM_ANALISE: 'alerta',
};

function Perfil() {
  const { usuario } = useAuth();
  const linhas = [
    { rotulo: 'Nome', valor: usuario?.nomeRazaoSocial },
    { rotulo: 'E-mail', valor: usuario?.email },
    { rotulo: 'Documento', valor: usuario?.cpfCnpj },
    { rotulo: 'Telefone', valor: usuario?.telefone },
    { rotulo: 'Perfil de acesso', valor: usuario?.papeis.join(', ') },
  ].filter((l) => l.valor);

  return (
    <Cartao
      icone={UserRound}
      titulo="Perfil"
      descricao="Dados do titular desta conta."
      acessorio={
        usuario?.situacao && (
          <Selo tom={SITUACAO_TOM[usuario.situacao] ?? 'neutro'}>
            {usuario.situacao.replaceAll('_', ' ')}
          </Selo>
        )
      }
    >
      <dl className="space-y-2.5">
        {linhas.map((l) => (
          <div
            key={l.rotulo}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
          >
            <dt className="text-xs uppercase tracking-wide opacity-50">{l.rotulo}</dt>
            <dd className="min-w-0 break-all text-sm font-medium">{l.valor}</dd>
          </div>
        ))}
      </dl>
    </Cartao>
  );
}

const TEMAS = [
  { v: 'PADRAO', label: 'Automático', icone: Monitor },
  { v: 'CLARO', label: 'Claro', icone: Sun },
  { v: 'ESCURO', label: 'Escuro', icone: Moon },
] as const;

function Aparencia() {
  const { usuario, patchTema } = useAuth();
  return (
    <Cartao
      icone={Palette}
      titulo="Aparência"
      descricao="Vale para este e para os próximos acessos."
      // Segmentado no cabeçalho: três opções não justificam um corpo inteiro.
      acessorio={
        <div className="flex rounded-full border border-ink-800/10 p-1 dark:border-white/10">
          {TEMAS.map((t) => {
            const ativo = usuario?.temaPreferido === t.v;
            return (
              <button
                key={t.v}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={ativo}
                onClick={() => void patchTema(t.v)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                  ativo
                    ? 'bg-accent text-accent-foreground'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <t.icone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                <span className={ativo ? '' : 'hidden xl:inline'}>{t.label}</span>
              </button>
            );
          })}
        </div>
      }
    />
  );
}

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
      setInicio(
        await api<InicioTotp>('/auth/totp/iniciar', { token: token!, method: 'POST' }),
      );
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

  // Sem passo em andamento nem mensagem, o cartão não tem corpo: vira uma linha
  // com selo e ação no cabeçalho, em vez de uma caixa alta com um botão solto.
  const temCorpo = !!ok || !!erro || (!ativo && !!inicio) || (ativo && desativando);

  return (
    <Cartao
      id="seguranca"
      icone={ShieldCheck}
      titulo="Verificação em duas etapas"
      descricao="Pede um código do autenticador além da senha."
      acessorio={
        <>
          <Selo tom={ativo ? 'ok' : 'neutro'}>{ativo ? 'Ativa' : 'Inativa'}</Selo>
          {!ativo && !inicio && (
            <button
              type="button"
              onClick={iniciar}
              disabled={loading}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Gerando…' : 'Ativar'}
            </button>
          )}
          {ativo && !desativando && (
            <button
              type="button"
              onClick={() => setDesativando(true)}
              className="rounded-lg border border-red-500/40 px-3.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              Desativar
            </button>
          )}
        </>
      }
    >
      {temCorpo ? (
      <div className="space-y-3">
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {/* `flex-wrap` porque este cartão vive na coluna estreita: se não couber
            lado a lado, o QR sobe e o passo a passo desce inteiro. */}
        {!ativo && inicio && (
          <form onSubmit={confirmar} className="flex flex-wrap gap-4">
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inicio.qrCodeDataUrl}
                alt="QR Code para configurar a verificação em duas etapas"
                className="h-36 w-36 rounded-xl bg-white p-2 ring-1 ring-ink-800/10 dark:ring-white/10"
              />
            </div>
            <div className="min-w-[13rem] flex-1 space-y-3">
              <p className="text-sm">
                <strong>1.</strong> Leia o QR Code no seu aplicativo autenticador
                (Google Authenticator, Authy, 1Password…).
              </p>
              <p className="text-xs opacity-70">
                Não consegue ler? Use este código:
                <code className="mt-1 block break-all rounded bg-ink-800/5 px-2 py-1 font-mono dark:bg-white/5">
                  {inicio.segredo}
                </code>
              </p>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>
                  <strong>2.</strong> Código de 6 dígitos
                </TextoRotulo>
                <input
                  className={`${inputBase} text-center font-mono text-lg tracking-[0.4em]`}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
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
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
                >
                  {loading ? 'Confirmando…' : 'Confirmar e ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInicio(null);
                    setCodigo('');
                  }}
                  className="rounded-lg border border-ink-800/15 px-4 py-2 text-sm dark:border-white/15"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {ativo && desativando && (
          <form onSubmit={desabilitar} className="space-y-3">
            <p className="text-sm opacity-70">
              Para desativar, confirme sua senha. Se ainda tiver o aplicativo,
              informe também o código.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Senha</TextoRotulo>
                <input
                  className={inputBase}
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                Código (opcional)
                <input
                  className={inputBase}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Desativando…' : 'Confirmar desativação'}
              </button>
              <button
                type="button"
                onClick={() => setDesativando(false)}
                className="rounded-lg border border-ink-800/15 px-4 py-2 text-sm dark:border-white/15"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
      ) : undefined}
    </Cartao>
  );
}

function AlteracaoSenha() {
  const { token, usuario, refreshMe } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const iguais = novaSenha.length > 0 && novaSenha === confirmacao;
  const regrasOk = REGRAS_SENHA.every((r) => r.ok(novaSenha));
  const podeSalvar = !!senhaAtual && regrasOk && iguais;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    const codigoTotp = pedirCodigoTotp();
    if (!codigoTotp) return;
    setSalvando(true);
    try {
      await api('/painel/conta/senha', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({
          senhaAtual,
          novaSenha,
          confirmacaoNovaSenha: confirmacao,
          codigoTotp,
        }),
      });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      setOk('Senha alterada com sucesso.');
      await refreshMe();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao alterar a senha');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao
      icone={KeyRound}
      titulo="Alteração de senha"
      descricao="Confirme a senha atual para definir uma nova."
      acessorio={
        usuario?.senhaAlteradaEm && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-800/5 px-2.5 py-1 text-[11px] opacity-70 dark:bg-white/5"
            title={`Última alteração de senha em ${dataHora(usuario.senhaAlteradaEm)}`}
          >
            <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
            Alterada em {dataHora(usuario.senhaAlteradaEm).replace(', ', ' às ')}
          </span>
        )
      }
    >
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <TextoRotulo obrigatorio>Senha atual</TextoRotulo>
            <input
              className={inputBase}
              type="password"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Nova senha</TextoRotulo>
            <input
              className={inputBase}
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
              className={inputBase}
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
            />
          </label>
        </div>

        <ul className="grid gap-1.5 rounded-xl bg-ink-800/[0.03] p-3 sm:grid-cols-2 sm:gap-x-5 dark:bg-white/[0.03]">
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

        <p className="rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-2.5 text-xs leading-relaxed">
          <strong>Importante:</strong> a nova senha passa a valer imediatamente para o
          acesso de <strong>{usuario?.email}</strong> em todo o {BRAND.nome} — painel,
          envio de documentos e confirmações que pedem senha (saque e 2FA). As
          credenciais de API não mudam.
        </p>

        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!podeSalvar || salvando}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </div>
      </form>
    </Cartao>
  );
}

type Elegibilidade = {
  podeEncerrar: boolean;
  requisitos: Array<{
    id: string;
    texto: string;
    atendido: boolean;
    detalhe?: string;
  }>;
};

function EncerrarConta() {
  const { token, usuario, logout } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [codigoTotp, setCodigoTotp] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['conta-encerramento'],
    enabled: !!token,
    queryFn: () => api<Elegibilidade>('/painel/conta/encerramento', { token: token! }),
  });

  const confirmou = confirmacaoTexto.trim().toUpperCase() === 'ENCERRAR';
  const podeConfirmar = !!senha && confirmou && codigoTotp.length === 6;
  const pendentes = data?.requisitos.filter((r) => !r.atendido).length ?? 0;

  async function encerrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEncerrando(true);
    try {
      await api('/painel/conta/encerrar', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({
          senha,
          codigoTotp,
          motivo: motivo || undefined,
        }),
      });
      // Conta encerrada: o token já não vale mais na próxima requisição.
      logout();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao encerrar a conta');
      setEncerrando(false);
      void refetch();
    }
  }

  return (
    <Cartao
      perigo
      icone={Trash2}
      titulo="Encerrar conta"
      descricao="Desliga o acesso desta conta. Não apaga o histórico."
      acessorio={
        data && (
          <Selo tom={data.podeEncerrar ? 'alerta' : 'neutro'}>
            {data.podeEncerrar
              ? 'Liberado'
              : `${pendentes} pendência${pendentes === 1 ? '' : 's'}`}
          </Selo>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p className="opacity-80">
            Ao encerrar sua conta no {BRAND.nome} você perde o acesso ao sistema: o
            painel deixa de abrir, as credenciais de API são revogadas e os webhooks
            param de ser entregues.
          </p>
          <p className="rounded-xl bg-ink-800/[0.03] px-3 py-2.5 text-xs leading-relaxed dark:bg-white/[0.03]">
            <strong>Seus dados não são apagados.</strong> Transações, cobranças,
            saques e documentos continuam guardados — é o que sustenta obrigação
            fiscal e qualquer contestação futura. Para voltar a operar, fale com o
            suporte: a reabertura é feita por lá, sem novo cadastro.
          </p>
          <p className="text-xs opacity-60">
            Dúvidas: {BRAND.email} · WhatsApp {BRAND.whatsapp}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">
            Para encerrar é necessário
          </h3>
          {isLoading && (
            <p className="mt-2 text-sm opacity-60">Verificando pendências…</p>
          )}
          <ul className="mt-2.5 space-y-2">
            {data?.requisitos.map((r) => (
              <li key={r.id} className="text-sm leading-snug">
                <span
                  className={`flex items-start gap-2 ${
                    r.atendido
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {r.atendido ? (
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : (
                    <X
                      className="mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                  {r.texto}
                </span>
                {r.detalhe && (
                  <span className="mt-0.5 block pl-6 text-xs opacity-60">
                    {r.detalhe}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={!data?.podeEncerrar}
            onClick={() => setAberto(true)}
            className="mt-4 w-full rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
          >
            Encerrar conta
          </button>
          {data && !data.podeEncerrar && (
            <p className="mt-2 text-center text-xs opacity-55">
              Resolva as pendências acima para liberar o encerramento.
            </p>
          )}
        </div>
      </div>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Encerrar conta">
        <form onSubmit={encerrar} className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>
              Esta ação desliga o acesso da conta <strong>{usuario?.email}</strong>{' '}
              imediatamente.
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Senha</TextoRotulo>
              <input
                className={inputBase}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </label>

            <label className="block text-sm">
              <TextoRotulo obrigatorio>Código 2FA</TextoRotulo>
              <input
                className={`${inputBase} text-center font-mono tracking-[0.3em]`}
                value={codigoTotp}
                onChange={(e) =>
                  setCodigoTotp(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                required
              />
            </label>
          </div>

          <label className="block text-sm">
            Motivo (opcional)
            <textarea
              className={inputBase}
              rows={2}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Conte o que motivou o encerramento"
            />
          </label>

          <label className="block text-sm">
            <TextoRotulo obrigatorio>Digite ENCERRAR para confirmar</TextoRotulo>
            <input
              className={`${inputBase} font-mono tracking-widest`}
              value={confirmacaoTexto}
              onChange={(e) => setConfirmacaoTexto(e.target.value)}
              placeholder="ENCERRAR"
              required
            />
          </label>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}

          <ModalAcoes
            onCancelar={() => setAberto(false)}
            rotulo="Encerrar minha conta"
            pendente={encerrando}
            desabilitado={!podeConfirmar}
          />
        </form>
      </Modal>
    </Cartao>
  );
}

export default function ConfigPage() {
  // Deep-link do CTA "Ativar 2FA" (`/configuracoes#seguranca`).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#seguranca') return;
    const el = document.getElementById('seguranca');
    if (!el) return;
    // Um tick para o layout do Shell assentar antes do scroll.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <Shell>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Configurações
        </h1>
        <p className="mt-1 text-sm opacity-60">
          Perfil, aparência e segurança da conta.
        </p>
      </div>

      {/* Duas colunas no desktop, empilhadas no celular.
          A distribuição segue a ALTURA de cada cartão, não o assunto: o
          formulário de senha é o mais alto e fica sozinho à direita, enquanto os
          três cartões curtos se somam à esquerda e fecham na mesma linha de
          base. Agrupar por assunto deixava a coluna da esquerda pela metade. */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Perfil />
          <Seguranca />
          <Aparencia />
        </div>
        <div className="lg:col-span-7">
          <AlteracaoSenha />
        </div>
        <div className="lg:col-span-12">
          <EncerrarConta />
        </div>
      </div>
    </Shell>
  );
}
