'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Shell } from '@/components/shell';
import { Ajuda } from '@/components/ajuda';
import { Modal, ModalAcoes } from '@/components/modal';
import { TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { PERMISSOES } from '@/lib/permissoes';
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
  destaque = false,
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
  /** Moldura em evidência para o cartão que exige ação (ex.: 2FA obrigatório). */
  destaque?: boolean;
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
          : destaque
            ? 'border-accent/60 ring-2 ring-accent/40 shadow-lg dark:border-accent/50'
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
  const { token, usuario, refreshMe, pode } = useAuth();
  const [inicio, setInicio] = useState<InicioTotp | null>(null);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const ativo = usuario?.totpHabilitado ?? false;
  // Perfil administrativo sem TOTP: a API responde 403 em todo o resto do
  // painel até a ativação — este cartão é a única saída, então ele assume o
  // protagonismo da tela (moldura em destaque + QR aberto sem clique).
  const obrigatorio = !ativo && pode(PERMISSOES.ESCOPO_GLOBAL);

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

  // Na ativação obrigatória o QR abre sozinho: quem chega aqui veio do
  // redirecionamento do Shell e o único caminho possível é ativar — o clique
  // em "Ativar" seria só um degrau a mais na frente de quem já está travado.
  const iniciouSozinho = useRef(false);
  useEffect(() => {
    if (!obrigatorio || !token || inicio || iniciouSozinho.current) return;
    iniciouSozinho.current = true;
    void iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obrigatorio, token, inicio]);

  async function copiarSegredo() {
    if (!inicio) return;
    try {
      await navigator.clipboard.writeText(inicio.segredo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem clipboard (http/permissão): o código continua visível para seleção manual.
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
  // Na ativação obrigatória sempre há corpo: o aviso de bloqueio + o QR.
  const temCorpo =
    obrigatorio || !!ok || !!erro || (!ativo && !!inicio) || (ativo && desativando);

  return (
    <Cartao
      id="seguranca"
      icone={obrigatorio ? ShieldAlert : ShieldCheck}
      destaque={obrigatorio}
      titulo="Verificação em duas etapas"
      descricao={
        obrigatorio
          ? 'Obrigatória para o seu perfil de acesso — ative abaixo para desbloquear o painel.'
          : 'Pede um código do autenticador além da senha.'
      }
      acessorio={
        <>
          <Selo tom={ativo ? 'ok' : obrigatorio ? 'alerta' : 'neutro'}>
            {ativo ? 'Ativa' : obrigatorio ? 'Ação necessária' : 'Inativa'}
          </Selo>
          {!ativo && !inicio && !obrigatorio && (
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

        {obrigatorio && (
          <div className="flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm leading-relaxed">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              strokeWidth={2}
              aria-hidden
            />
            <span>
              <strong>O restante do painel fica bloqueado até você concluir esta
              ativação.</strong>{' '}
              Você vai precisar de um aplicativo autenticador (Google
              Authenticator, Authy, 1Password…) — leva menos de um minuto.
            </span>
          </div>
        )}

        {obrigatorio && !inicio && loading && (
          <p className="py-4 text-center text-sm opacity-60">
            Preparando a ativação…
          </p>
        )}

        {/* `flex-wrap` porque este cartão pode viver na coluna estreita: se não
            couber lado a lado, o QR sobe e o passo a passo desce inteiro. */}
        {!ativo && inicio && (
          <form onSubmit={confirmar} className="flex flex-wrap gap-4">
            <div className="w-full space-y-3 sm:w-auto sm:shrink-0">
              {/* No celular o QR está NA tela do autenticador — impossível de
                  escanear. O caminho principal ali é abrir o app direto pelo
                  link otpauth; o QR fica como alternativa para quem usa outro
                  aparelho. */}
              <a
                href={inicio.uri}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 sm:hidden"
              >
                <Smartphone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                1. Toque para abrir no app autenticador
              </a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inicio.qrCodeDataUrl}
                alt="QR Code para configurar a verificação em duas etapas"
                className="mx-auto h-40 w-40 rounded-xl bg-white p-2 ring-1 ring-ink-800/10 sm:mx-0 sm:h-36 sm:w-36 dark:ring-white/10"
              />
            </div>
            <div className="min-w-[13rem] flex-1 space-y-3">
              <p className="hidden text-sm sm:block">
                <strong>1.</strong> Leia o QR Code no seu aplicativo autenticador
                (Google Authenticator, Authy, 1Password…).
              </p>
              <div className="text-xs opacity-70">
                <span className="sm:hidden">
                  O botão não abriu seu app? Copie o código e cadastre manualmente:
                </span>
                <span className="hidden sm:inline">Não consegue ler? Use este código:</span>
                <div className="mt-1 flex items-stretch gap-1.5">
                  <code className="min-w-0 flex-1 break-all rounded bg-ink-800/5 px-2 py-1.5 font-mono dark:bg-white/5">
                    {inicio.segredo}
                  </code>
                  <button
                    type="button"
                    onClick={copiarSegredo}
                    title="Copiar código"
                    className="flex shrink-0 items-center gap-1 rounded border border-ink-800/15 px-2 text-xs transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
                  >
                    {copiado ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    )}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>
                  <strong>2.</strong> Código de 6 dígitos gerado pelo aplicativo
                </TextoRotulo>
                <input
                  className={`${inputBase} py-3 text-center font-mono text-xl tracking-[0.4em] sm:py-2 sm:text-lg`}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading || codigo.length !== 6}
                  className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60 sm:w-auto sm:py-2 sm:font-medium"
                >
                  {loading ? 'Confirmando…' : 'Confirmar e ativar'}
                </button>
                {/* Sem "Cancelar" na ativação obrigatória: fechar o passo não
                    destrava nada, só deixa a pessoa presa numa tela vazia. */}
                {!obrigatorio && (
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
                )}
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
    const codigoTotp = await pedirCodigoTotp();
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

        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {/* O detalhe do alcance da troca fica no tooltip — o caixão âmbar
            permanente deixava o formulário carregado. */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-xs opacity-60">
            Vale na hora, em todo o {BRAND.nome}
            <Ajuda
              texto={`A nova senha passa a valer imediatamente para o acesso de ${usuario?.email ?? 'sua conta'} em todo o ${BRAND.nome} — painel, envio de documentos e confirmações que pedem senha (saque e 2FA). As credenciais de API não mudam.`}
            />
          </span>
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
  const { usuario, pode } = useAuth();
  // Espelha o `exige2FA` do Shell: admin sem TOTP só tem esta tela.
  const obrigatorio2fa =
    !!usuario && !usuario.totpHabilitado && pode(PERMISSOES.ESCOPO_GLOBAL);
  // A posição não volta ao normal no instante em que a ativação conclui:
  // mover o cartão nesse momento remontaria o componente (perdendo a mensagem
  // de sucesso) e faria a tela saltar debaixo do dedo de quem acabou de digitar
  // o código. Volta ao lugar na próxima visita.
  const foiObrigatorio = useRef(false);
  if (obrigatorio2fa) foiObrigatorio.current = true;
  const segurancaNoTopo = obrigatorio2fa || foiObrigatorio.current;

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
          base. Agrupar por assunto deixava a coluna da esquerda pela metade.

          Exceção: com o 2FA obrigatório pendente, a ativação é a ÚNICA coisa
          que a pessoa consegue fazer — o cartão sobe para o topo em largura
          total (primeiro também na pilha do celular) e o resto desce. */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-12">
        {segurancaNoTopo && (
          <div className="lg:col-span-12">
            <Seguranca />
          </div>
        )}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Perfil />
          {!segurancaNoTopo && <Seguranca />}
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
