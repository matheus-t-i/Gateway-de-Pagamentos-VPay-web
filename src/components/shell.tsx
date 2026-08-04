'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Code2,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LineChart,
  Menu,
  Puzzle,
  ScrollText,
  Server,
  Settings2,
  ShieldAlert,
  Users,
  Wallet,
  Webhook,
  X,
  type LucideProps,
} from 'lucide-react';
import { Marca } from '@/components/marca';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Icone = ComponentType<LucideProps>;

type NavLink = { href: string; label: string; icone?: Icone };
type NavItem =
  | (NavLink & { icone: Icone })
  | { label: string; icone: Icone; children: NavLink[] };
type NavGrupo = {
  titulo: string;
  somenteAdmin?: boolean;
  links: NavItem[];
};

/**
 * Navegação agrupada por domínio. Submenus colapsáveis reduzem ruído visual.
 * O administrador também é cliente: vê todos os grupos; Administrador só com
 * papel ADMINISTRADOR.
 */
const GRUPOS: NavGrupo[] = [
  {
    titulo: 'Operação',
    links: [
      { href: '/dashboard', label: 'Dashboard', icone: LayoutDashboard },
      { href: '/transacoes', label: 'Transações', icone: ArrowLeftRight },
    ],
  },
  {
    titulo: 'Conta',
    links: [
      { href: '/empresas', label: 'Empresas', icone: Building2 },
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
          { href: '/desenvolvedores/integracoes', label: 'Integrações', icone: Puzzle },
          { href: '/desenvolvedores/documentacao', label: 'Documentação', icone: BookOpen },
        ],
      },
    ],
  },
  {
    titulo: 'Administrador',
    somenteAdmin: true,
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
        children: [{ href: '/admin/usuarios', label: 'Usuários', icone: Users }],
      },
      {
        label: 'Financeiro',
        icone: Wallet,
        children: [
          { href: '/admin/saldos', label: 'Saldos e saques', icone: Wallet },
          { href: '/admin/relatorios/cash-in', label: 'Cash-in', icone: ArrowDownToLine },
          { href: '/admin/relatorios/cash-out', label: 'Cash-out', icone: ArrowUpFromLine },
          {
            href: '/admin/relatorios/resultado',
            label: 'Lucro × Custo',
            icone: LineChart,
          },
        ],
      },
      { href: '/admin/med', label: 'MED', icone: ShieldAlert },
      {
        label: 'Plataforma',
        icone: Server,
        children: [
          { href: '/admin/adquirentes', label: 'Adquirentes', icone: Landmark },
          { href: '/admin/filas', label: 'Filas', icone: Layers },
          { href: '/admin/auditoria', label: 'Auditoria', icone: ScrollText },
        ],
      },
    ],
  },
];

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
  const { usuario } = useAuth();
  const isAdmin = usuario?.papeis.includes('ADMINISTRADOR') ?? false;

  return (
    <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pb-4">
      {GRUPOS.filter((g) => !g.somenteAdmin || isAdmin).map((g) => (
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
      <div className="flex items-start justify-between gap-2">
        <Marca href="/dashboard" className="px-1" />
        {onFechar && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onFechar}
            className="rounded-lg p-1.5 opacity-60 transition hover:bg-ink-800/5 hover:opacity-100 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <Navegacao onNavegar={onNavegar} />
    </div>
  );
}

/** Seletor de empresa ativa, no topo à direita. */
function SeletorEmpresa() {
  const { token, empresaId, setEmpresaId } = useAuth();
  const empresas = useQuery({
    queryKey: ['empresas-topo'],
    enabled: !!token,
    queryFn: () =>
      api<Array<{ idPublico: string; razaoSocial: string }>>('/empresas', {
        token: token!,
      }),
  });
  if (!empresas.data?.length) return null;
  return (
    <select
      aria-label="Empresa ativa"
      className="max-w-[9rem] truncate rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-900 sm:max-w-[14rem]"
      value={empresaId ?? ''}
      onChange={(e) => setEmpresaId(e.target.value || null)}
    >
      <option value="">Todas as empresas</option>
      {empresas.data.map((e) => (
        <option key={e.idPublico} value={e.idPublico}>
          {e.razaoSocial}
        </option>
      ))}
    </select>
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

export function Shell({ children }: { children: React.ReactNode }) {
  const { token, hidratando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!hidratando && !token) router.replace('/login');
  }, [hidratando, token, router]);

  useEffect(() => {
    setDrawer(false);
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
            <SeletorEmpresa />
            <MenuUsuario />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
