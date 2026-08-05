'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Banknote,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Code2,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Menu,
  ScrollText,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  Webhook,
  X,
  type LucideProps,
} from 'lucide-react';
import { Marca } from '@/components/marca';
import { useAuth } from '@/lib/auth';
import { permissaoDaRota, type CodigoPermissao } from '@/lib/permissoes';

type Icone = ComponentType<LucideProps>;

type NavLink = { href: string; label: string; icone?: Icone };
type NavItem =
  | (NavLink & { icone: Icone })
  | { label: string; icone: Icone; children: NavLink[] };
type NavGrupo = {
  titulo: string;
  links: NavItem[];
};

/**
 * Navegação agrupada por domínio. Submenus colapsáveis reduzem ruído visual.
 *
 * O que aparece é decidido pelo PERFIL DE ACESSO: cada link é filtrado pela
 * permissão de leitura da sua tela (`permissaoDaRota`), e grupo/submenu que
 * ficam sem nenhum filho somem. Links sem permissão mapeada (Configurações,
 * Documentação) são conta própria e ficam sempre visíveis.
 */
const GRUPOS: NavGrupo[] = [
  {
    titulo: 'Operação',
    links: [
      { href: '/dashboard', label: 'Dashboard', icone: LayoutDashboard },
      { href: '/faturamento', label: 'Faturamento', icone: Trophy },
      { href: '/transacoes', label: 'Transações', icone: ArrowLeftRight },
    ],
  },
  {
    titulo: 'Conta',
    links: [
      { href: '/adquirentes', label: 'Adquirentes', icone: Landmark },
      { href: '/configuracoes', label: 'Configurações', icone: Settings2 },
    ],
  },
  {
    titulo: 'Desenvolvedores',
    links: [
      {
        label: 'API',
        icone: Code2,
        children: [
          { href: '/desenvolvedores/chaves', label: 'Chaves de API', icone: KeyRound },
          { href: '/desenvolvedores/webhooks', label: 'Webhooks', icone: Webhook },
          { href: '/desenvolvedores/documentacao', label: 'Documentação', icone: BookOpen },
        ],
      },
    ],
  },
  {
    titulo: 'Administrador',
    links: [
      {
        label: 'Pendências',
        icone: ClipboardCheck,
        children: [
          { href: '/admin/aprovacoes', label: 'Aprovações', icone: ClipboardCheck },
          { href: '/admin/chaves-pix', label: 'Chaves PIX', icone: KeyRound },
        ],
      },
      {
        label: 'Pessoas',
        icone: Users,
        children: [
          { href: '/admin/usuarios', label: 'Usuários', icone: Users },
          { href: '/admin/perfis', label: 'Perfis de acesso', icone: ShieldCheck },
        ],
      },
      {
        label: 'Financeiro',
        icone: Wallet,
        children: [
          { href: '/admin/carteiras', label: 'Carteiras dos clientes', icone: Wallet },
          { href: '/admin/relatorios/cash-in', label: 'Cash-in', icone: ArrowDownToLine },
          { href: '/admin/relatorios/cash-out', label: 'Cash-out', icone: ArrowUpFromLine },
          {
            href: '/admin/relatorios/resultado',
            label: 'Lucro × Custo',
            icone: LineChart,
          },
        ],
      },
      {
        label: 'Adquirentes',
        icone: Landmark,
        children: [
          { href: '/admin/adquirentes', label: 'Cadastro Adquirentes', icone: Landmark },
          { href: '/admin/saldos', label: 'Saldos Adquirentes', icone: Banknote },
          { href: '/admin/contingencia', label: 'Contingência', icone: LifeBuoy },
        ],
      },
      { href: '/admin/med', label: 'MED', icone: ShieldAlert },
      {
        label: 'Plataforma',
        icone: Server,
        children: [
          { href: '/admin/filas', label: 'Filas', icone: Layers },
          { href: '/admin/auditoria', label: 'Auditoria', icone: ScrollText },
        ],
      },
    ],
  },
];

/** Filtra a navegação pelas permissões do perfil, removendo grupos vazios. */
function filtrarNavegacao(
  pode: (c: CodigoPermissao) => boolean,
): NavGrupo[] {
  const visivel = (href: string) => {
    const codigo = permissaoDaRota(href);
    return !codigo || pode(codigo);
  };
  return GRUPOS.map((g) => ({
    ...g,
    links: g.links
      .map((l) =>
        'children' in l
          ? { ...l, children: l.children.filter((c) => visivel(c.href)) }
          : l,
      )
      .filter((l) => ('children' in l ? l.children.length > 0 : visivel(l.href))),
  })).filter((g) => g.links.length > 0);
}

function LinkNav({
  href,
  label,
  icone: Icone,
  onNavegar,
  indentado,
}: {
  href: string;
  label: string;
  icone?: Icone;
  onNavegar?: () => void;
  indentado?: boolean;
}) {
  const pathname = usePathname();
  const ativo = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      onClick={onNavegar}
      className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
        indentado ? 'py-2 text-[13px]' : ''
      } ${
        ativo
          ? 'border border-accent/40 bg-accent/10 font-medium text-accent shadow-[inset_0_0_0_1px_rgba(255,193,7,0.12)]'
          : 'border border-transparent text-ink-900/75 hover:bg-ink-800/5 hover:text-ink-900 dark:text-sand-50/70 dark:hover:bg-white/[0.04] dark:hover:text-sand-50'
      }`}
    >
      {Icone && (
        <Icone
          className={`h-[18px] w-[18px] shrink-0 ${
            ativo ? 'text-accent' : 'opacity-55 group-hover:opacity-80'
          }`}
          strokeWidth={1.75}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {ativo && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_2px] shadow-accent/70"
        />
      )}
    </Link>
  );
}

/** Subgrupo colapsável (ex.: Financeiro dentro de Administrador). */
function SubMenu({
  label,
  icone: Icone,
  children,
  onNavegar,
}: {
  label: string;
  icone: Icone;
  children: NavLink[];
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const algumAtivo = children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
  );
  const [aberto, setAberto] = useState(algumAtivo);

  useEffect(() => {
    if (algumAtivo) setAberto(true);
  }, [algumAtivo]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
          algumAtivo
            ? 'border-transparent text-accent'
            : 'border-transparent text-ink-900/75 hover:bg-ink-800/5 hover:text-ink-900 dark:text-sand-50/70 dark:hover:bg-white/[0.04] dark:hover:text-sand-50'
        }`}
      >
        <Icone
          className={`h-[18px] w-[18px] shrink-0 ${
            algumAtivo ? 'text-accent' : 'opacity-55 group-hover:opacity-80'
          }`}
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 opacity-45 transition-transform duration-200 ${
            aberto ? 'rotate-90' : ''
          }`}
          strokeWidth={2}
        />
      </button>
      {aberto && (
        <div className="relative ml-4 mt-1 space-y-0.5 border-l border-ink-800/10 pl-2 dark:border-white/10">
          {children.map((c) => (
            <LinkNav
              key={c.href}
              href={c.href}
              label={c.label}
              icone={c.icone}
              onNavegar={onNavegar}
              indentado
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Navegacao({ onNavegar }: { onNavegar?: () => void }) {
  const { pode } = useAuth();
  const grupos = filtrarNavegacao(pode);

  return (
    <nav className="mt-3 flex-1 space-y-6 overflow-y-auto pb-4 lg:mt-4">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-40">
            {g.titulo}
          </p>
          <div className="space-y-0.5">
            {g.links.map((l) =>
              'children' in l ? (
                <SubMenu
                  key={l.label}
                  label={l.label}
                  icone={l.icone}
                  children={l.children}
                  onNavegar={onNavegar}
                />
              ) : (
                <LinkNav
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  icone={l.icone}
                  onNavegar={onNavegar}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PainelLateral({
  onNavegar,
  onFechar,
}: {
  onNavegar?: () => void;
  onFechar?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-0 flex items-center justify-center px-0 py-0">
        <Marca
          href="/dashboard"
          className="justify-center"
          imagemClassName="h-11 w-auto max-w-[12rem] object-contain object-center sm:h-12 lg:h-16 lg:max-w-full"
        />
        {onFechar && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onFechar}
            className="absolute right-0 top-0 rounded-lg p-1.5 opacity-60 transition hover:bg-ink-800/5 hover:opacity-100 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <Navegacao onNavegar={onNavegar} />
    </div>
  );
}

/**
 * Identificação da conta, no topo à direita. Um usuário É uma conta, então não
 * há o que trocar: isto é rótulo, não seletor.
 */
function NomeDaConta() {
  const { usuario } = useAuth();
  const nome = usuario?.nomeFantasia || usuario?.nomeRazaoSocial;
  if (!nome) return null;
  return (
    <span
      title={nome}
      className="hidden max-w-[9rem] truncate rounded-md border border-ink-800/15 px-2 py-1.5 text-sm dark:border-white/15 sm:inline-block sm:max-w-[14rem]"
    >
      {nome}
    </span>
  );
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** hh:mm:ss restantes — mesmo formato do relógio, sem depender de locale. */
function formatarRestante(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    doisDigitos(Math.floor(s / 3600)),
    doisDigitos(Math.floor((s % 3600) / 60)),
    doisDigitos(s % 60),
  ].join(':');
}

/**
 * Contagem regressiva até o token expirar. O `exp` vem do próprio JWT, então o
 * número na tela é o mesmo prazo que a API respeita — não é uma estimativa.
 * Quem derruba a sessão no zero é o AuthProvider.
 */
function ContadorSessao() {
  const { expiraEm } = useAuth();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!expiraEm) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiraEm]);

  if (!expiraEm) return null;

  const restante = expiraEm - agora;
  const minutos = restante / 60_000;
  const cor =
    minutos <= 1
      ? 'border-red-500/50 text-red-600 dark:text-red-400'
      : minutos <= 5
        ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
        : 'border-ink-800/15 dark:border-white/15';

  return (
    <span
      title={`Sua sessão expira em ${formatarRestante(restante)} (${new Date(
        expiraEm,
      ).toLocaleTimeString('pt-BR')})`}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tabular-nums sm:px-3 ${cor}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="sr-only">Sessão expira em </span>
      {formatarRestante(restante)}
    </span>
  );
}

/**
 * Estado do 2FA da conta. Leva para Configurações, onde ele é ativado — o
 * ponto do indicador é justamente incomodar quem está sem segundo fator.
 */
function IndicadorDoisFatores() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const ativo = !!usuario.totpHabilitado;
  const Icone = ativo ? ShieldCheck : ShieldAlert;

  return (
    <Link
      href="/configuracoes"
      title={
        ativo
          ? 'Autenticação em dois fatores ativa'
          : 'Autenticação em dois fatores inativa — clique para ativar'
      }
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 sm:px-3 ${
        ativo
          ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
          : 'border-accent/60 text-accent'
      }`}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="hidden sm:inline">2FA {ativo ? 'Ativo' : 'Inativo'}</span>
      <span className="sr-only sm:hidden">
        Dois fatores {ativo ? 'ativo' : 'inativo'}
      </span>
    </Link>
  );
}

/** Menu do usuário (dados + tema + sair) no topo à direita. */
function MenuUsuario() {
  const { usuario, logout, patchTema } = useAuth();
  const [aberto, setAberto] = useState(false);
  const inicial = (usuario?.nomeRazaoSocial || usuario?.email || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-ink-800/15 py-1 pl-1 pr-2 text-sm hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {inicial}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:block">{usuario?.email}</span>
        <span className="opacity-60">▾</span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-ink-800/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-ink-900">
            <p className="truncate text-sm font-medium">{usuario?.nomeRazaoSocial}</p>
            <p className="truncate text-xs opacity-60">{usuario?.email}</p>
            <div className="mt-3 border-t border-ink-800/10 pt-3 dark:border-white/10">
              <p className="text-xs opacity-60">Tema</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['PADRAO', 'CLARO', 'ESCURO'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => void patchTema(t)}
                    className={`rounded border px-2 py-1 text-xs ${
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
            <button
              type="button"
              onClick={logout}
              className="mt-3 w-full rounded-md border border-ink-800/15 px-3 py-2 text-left text-sm hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const classeAside =
  'flex flex-col border-ink-800/10 bg-white/70 px-4 py-5 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#121212]/95';

/** Query param que carrega a tela negada até a tela de destino. */
const PARAM_SEM_PERMISSAO = 'semPermissao';

/** Primeira tela do menu que o perfil consegue abrir (destino do redirecionamento). */
function primeiraTelaPermitida(pode: (c: CodigoPermissao) => boolean): string | null {
  for (const grupo of filtrarNavegacao(pode)) {
    for (const link of grupo.links) {
      if ('children' in link) {
        if (link.children[0]) return link.children[0].href;
      } else {
        return link.href;
      }
    }
  }
  return null;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { token, hidratando, usuario, pode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoLido = useRef<{ tela: string; em: string } | null>(null);

  useEffect(() => {
    if (!hidratando && !token) router.replace('/login');
  }, [hidratando, token, router]);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  /**
   * Guarda de rota: sem a permissão da tela, o perfil é mandado para a primeira
   * tela que ele consegue abrir, com aviso — antes valia digitar /admin/... na
   * barra de endereços e a tela carregava, quebrando só no 403 da API.
   *
   * Só roda com `usuario` já carregado: enquanto o /auth/me não volta, as
   * permissões estão vazias e todo mundo seria expulso da própria tela.
   */
  const permissaoExigida = permissaoDaRota(pathname);
  const negado = !!usuario && !!permissaoExigida && !pode(permissaoExigida);
  const destino = negado ? primeiraTelaPermitida(pode) : null;

  useEffect(() => {
    if (!negado || !destino) return;
    router.replace(`${destino}?${PARAM_SEM_PERMISSAO}=${encodeURIComponent(pathname)}`);
  }, [negado, destino, pathname, router]);

  /**
   * A tela negada viaja na query string, não em estado: cada página monta o seu
   * PRÓPRIO `<Shell>`, então o redirecionamento desmonta este componente e
   * qualquer `useState` daqui morreria junto. Lido o parâmetro, ele sai da URL
   * para não reaparecer num F5 — e o valor fica no ref porque em dev o
   * StrictMode roda o efeito duas vezes, e na segunda a URL já está limpa.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const daUrl = params.get(PARAM_SEM_PERMISSAO);
    if (daUrl) {
      avisoLido.current = { tela: daUrl, em: pathname };
      params.delete(PARAM_SEM_PERMISSAO);
      const qs = params.toString();
      window.history.replaceState(null, '', pathname + (qs ? `?${qs}` : ''));
    }
    const atual = avisoLido.current;
    setAviso(atual && atual.em === pathname ? atual.tela : null);
  }, [pathname]);

  if (hidratando) {
    return (
      <div className="px-4 py-8 text-sm opacity-60 sm:px-6">Carregando…</div>
    );
  }
  if (!token) return null;

  return (
    <div className="min-h-screen bg-sand-50 text-ink-900 dark:bg-ink-950 dark:text-sand-50 lg:flex">
      {/* Sidebar fixa (desktop) — menu à ESQUERDA */}
      <aside
        className={`hidden shrink-0 border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 ${classeAside}`}
      >
        <PainelLateral />
      </aside>

      {/* Drawer (mobile) — abre da esquerda */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setDrawer(false)}
        >
          <aside
            className={`h-full w-[18.5rem] max-w-[88vw] overflow-y-auto border-r shadow-2xl ${classeAside}`}
            onClick={(e) => e.stopPropagation()}
          >
            <PainelLateral
              onNavegar={() => setDrawer(false)}
              onFechar={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800/10 bg-sand-50/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-ink-950/80 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setDrawer(true)}
            className="rounded-xl border border-ink-800/15 p-2 dark:border-white/15 lg:hidden"
          >
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <Marca href="/dashboard" className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ContadorSessao />
            <IndicadorDoisFatores />
            <NomeDaConta />
            <MenuUsuario />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {aviso && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                strokeWidth={1.75}
              />
              <span>
                Seu perfil de acesso não dá permissão para a tela{' '}
                <code className="rounded bg-ink-800/10 px-1 dark:bg-white/10">
                  {aviso}
                </code>
                . Fale com um administrador se precisar desse acesso.
              </span>
            </div>
          )}
          {negado ? (
            <div className="rounded-lg border border-ink-800/10 px-4 py-10 text-center dark:border-white/10">
              <ShieldAlert
                className="mx-auto h-7 w-7 opacity-40"
                strokeWidth={1.5}
              />
              <p className="mt-3 text-sm font-medium">Sem permissão para esta tela</p>
              <p className="mt-1 text-sm opacity-60">
                Seu perfil de acesso não inclui{' '}
                <code className="rounded bg-ink-800/10 px-1 dark:bg-white/10">
                  {permissaoExigida}
                </code>
                .
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
