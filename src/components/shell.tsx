'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };
type NavGrupo = {
  titulo: string;
  somenteAdmin?: boolean;
  links: NavItem[];
};

/**
 * Navegação agrupada por área. O administrador também é cliente: vê todos os
 * grupos; o grupo Administrador só aparece para o papel ADMINISTRADOR.
 */
const GRUPOS: NavGrupo[] = [
  {
    titulo: 'Pagamentos',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/transacoes', label: 'Transações' },
    ],
  },
  {
    titulo: 'Conta',
    links: [
      { href: '/empresas', label: 'Empresas' },
      { href: '/configuracoes', label: 'Configurações' },
    ],
  },
  {
    titulo: 'Desenvolvedores',
    links: [
      { href: '/desenvolvedores/chaves', label: 'Chaves de API' },
      { href: '/desenvolvedores/webhooks', label: 'Webhooks' },
      { href: '/desenvolvedores/integracoes', label: 'Integrações' },
      { href: '/desenvolvedores/documentacao', label: 'Documentação' },
    ],
  },
  {
    titulo: 'Administrador',
    somenteAdmin: true,
    links: [
      { href: '/admin/aprovacoes', label: 'Aprovações' },
      { href: '/admin/usuarios', label: 'Usuários' },
      {
        label: 'Relatórios',
        children: [
          { href: '/admin/relatorios/cash-in', label: 'Cash-in' },
          { href: '/admin/relatorios/cash-out', label: 'Cash-out' },
          { href: '/admin/relatorios/resultado', label: 'Lucro × Custo' },
        ],
      },
      { href: '/admin/saldos', label: 'Saldos e saques' },
      { href: '/admin/chaves-pix', label: 'Chaves PIX' },
      { href: '/admin/med', label: 'MED' },
      { href: '/admin/adquirentes', label: 'Adquirentes' },
      { href: '/admin/auditoria', label: 'Auditoria' },
      { href: '/admin/filas', label: 'Filas' },
    ],
  },
];

function Marca() {
  return (
    <Link href="/dashboard" className="font-display text-2xl font-semibold text-accent">
      {BRAND.nome}
    </Link>
  );
}

function LinkNav({
  href,
  label,
  onNavegar,
  indentado,
}: {
  href: string;
  label: string;
  onNavegar?: () => void;
  indentado?: boolean;
}) {
  const pathname = usePathname();
  const ativo = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      onClick={onNavegar}
      className={`block rounded-md px-3 py-2 transition ${
        indentado ? 'text-[13px]' : 'text-sm'
      } ${
        ativo
          ? 'bg-accent font-medium text-accent-foreground'
          : indentado
            ? 'opacity-80 hover:bg-ink-800/5 hover:opacity-100 dark:hover:bg-white/5'
            : 'hover:bg-ink-800/5 dark:hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  );
}

/** Subgrupo colapsável (ex.: Relatórios dentro de Administrador). */
function SubMenu({
  label,
  children,
  onNavegar,
}: {
  label: string;
  children: NavLink[];
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const algumAtivo = children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
  );
  const [aberto, setAberto] = useState(algumAtivo);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:hover:bg-white/5 ${
          algumAtivo ? 'text-accent' : ''
        }`}
      >
        <span
          className={`text-[10px] transition-transform ${aberto ? 'rotate-90' : ''} opacity-70`}
        >
          ▶
        </span>
        <span>{label}</span>
      </button>
      {aberto && (
        <div className="relative ml-[18px] mt-1 space-y-0.5 border-l-2 border-ink-800/15 pl-2 dark:border-white/20">
          {children.map((c) => (
            <LinkNav key={c.href} href={c.href} label={c.label} onNavegar={onNavegar} indentado />
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
    <nav className="mt-6 space-y-5">
      {GRUPOS.filter((g) => !g.somenteAdmin || isAdmin).map((g) => (
        <div key={g.titulo}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-widest opacity-50">
            {g.titulo}
          </p>
          <div className="mt-1.5 space-y-0.5">
            {g.links.map((l) =>
              'children' in l ? (
                <SubMenu key={l.label} label={l.label} children={l.children} onNavegar={onNavegar} />
              ) : (
                <LinkNav key={l.href} href={l.href} label={l.label} onNavegar={onNavegar} />
              ),
            )}
          </div>
        </div>
      ))}
    </nav>
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
      <aside className="hidden shrink-0 border-r border-ink-800/10 px-4 py-6 dark:border-white/10 lg:block lg:w-60">
        <Marca />
        <Navegacao />
      </aside>

      {/* Drawer (mobile) — abre da esquerda */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setDrawer(false)}
        >
          <aside
            className="h-full w-72 max-w-[85vw] overflow-y-auto bg-sand-50 px-5 py-6 dark:bg-ink-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <Marca />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setDrawer(false)}
                className="rounded px-2 py-1 text-sm opacity-70"
              >
                ✕
              </button>
            </div>
            <Navegacao onNavegar={() => setDrawer(false)} />
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
            className="rounded-md border border-ink-800/15 px-3 py-1.5 text-sm dark:border-white/15 lg:hidden"
          >
            ☰
          </button>
          <span className="font-display text-lg font-semibold text-accent lg:hidden">
            {BRAND.nome}
          </span>
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
