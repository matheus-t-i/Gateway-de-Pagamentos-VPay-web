'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Shell } from '@/components/shell';
import { DepositoModal, SaqueModal } from '@/components/conta-acoes';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

const RANGES = [
  { v: 'mes', label: 'Mês' },
  { v: '30d', label: '30 dias' },
  { v: '7d', label: '7 dias' },
  { v: '1d', label: '1 dia' },
] as const;

type Painel = {
  range: string;
  saldoDisponivel: string;
  totais: { gerados: string; pagos: string; meds: string };
  ticketMedio: string;
  conversao: number;
  geradasQtd: number;
  aprovadasQtd: number;
  serie: Array<{ ts: string; geradas: string; aprovadas: string }>;
  recentes: Array<{
    idTransacao: string;
    cliente: string;
    clienteEmail: string | null;
    produto: string;
    valor: string;
    situacao: string;
    criadoEm: string;
  }>;
  conta: {
    idPublico: string;
    nome: string;
    situacao: string;
    saldo: {
      disponivel: string;
      pendente: string;
      reservado: string;
      bloqueadoMed: string;
    } | null;
  };
};

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function rotuloSerie(ts: string, range: string) {
  if (range === '1d') {
    const h = ts.split('T')[1] ?? '0';
    return `${String(h).padStart(2, '0')}h`;
  }
  const [, m, d] = (ts.split('T')[0] ?? '').split('-');
  return `${d}/${Number(m) + 1}`;
}

const CORES_STATUS: Record<string, string> = {
  CONCLUIDA: 'text-emerald-600 dark:text-emerald-400',
  LIQUIDADA: 'text-emerald-600 dark:text-emerald-400',
  AGUARDANDO_PAGAMENTO: 'text-amber-600 dark:text-amber-400',
  PROCESSANDO: 'text-amber-600 dark:text-amber-400',
  PENDENTE: 'text-amber-600 dark:text-amber-400',
  FALHA: 'text-red-600 dark:text-red-400',
  CANCELADA: 'text-red-600 dark:text-red-400',
  DEVOLVIDA: 'text-red-600 dark:text-red-400',
};

function Painel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-800/10 bg-white dark:border-white/10 dark:bg-ink-900 ${className}`}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { token, usuario, pode } = useAuth();
  const isAdmin = usuario?.papeis.includes('ADMINISTRADOR');
  const [range, setRange] = useState<string>('1d');
  const [mostrarSaldo, setMostrarSaldo] = useState(true);
  const [saqueAberto, setSaqueAberto] = useState(false);
  const [depositoAberto, setDepositoAberto] = useState(false);

  const painel = useQuery({
    queryKey: ['painel-dashboard', range],
    enabled: !!token,
    queryFn: () => api<Painel>(`/painel/dashboard?range=${range}`, { token: token! }),
  });

  const admin = useQuery({
    queryKey: ['admin-dashboard'],
    enabled: !!token && !!isAdmin,
    queryFn: () =>
      api<{
        usuarios: number;
        clientesAtivos: number;
        transacoes: number;
        volumeBruto: string;
        serie: Array<{ dia: string; volume: string }>;
      }>('/admin/dashboard', { token: token! }),
  });

  const d = painel.data;
  const chart =
    d?.serie.map((s) => ({
      label: rotuloSerie(s.ts, d.range),
      geradas: Number(s.geradas),
      aprovadas: Number(s.aprovadas),
    })) ?? [];

  const contaAtiva = d?.conta.situacao === 'ATIVO';
  const conversaoPct = ((d?.conversao ?? 0) * 100).toFixed(1).replace('.', ',');

  return (
    <Shell>
      {/* Cabeçalho + ranges numa linha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.v}
              type="button"
              onClick={() => setRange(r.v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                range === r.v
                  ? 'bg-accent text-accent-foreground'
                  : 'border border-ink-800/15 hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Composição principal: saldo + métricas + gráfico */}
      <div className="mt-5 grid gap-3 lg:grid-cols-12">
        {/* Saldo */}
        <Painel className="overflow-hidden bg-gradient-to-br from-accent to-accent-strong p-4 text-accent-foreground sm:p-5 lg:col-span-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Saldo disponível
            </p>
            <button
              type="button"
              aria-label={mostrarSaldo ? 'Ocultar saldo' : 'Mostrar saldo'}
              onClick={() => setMostrarSaldo((v) => !v)}
              className="rounded-md p-1 opacity-80 transition hover:bg-black/10 hover:opacity-100"
            >
              {mostrarSaldo ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {mostrarSaldo ? brl(d?.saldoDisponivel ?? '0') : 'R$ ••••'}
          </p>
          <p className="mt-1 text-[11px] opacity-70">
            Bloqueado MED: {mostrarSaldo ? brl(d?.totais.meds ?? '0') : '••••'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {pode(PERMISSOES.TRANSACOES_CRIAR) && (
              <button
                type="button"
                disabled={!contaAtiva}
                onClick={() => setDepositoAberto(true)}
                className="rounded-md bg-black/10 px-3 py-1.5 text-xs font-medium transition hover:bg-black/15 disabled:opacity-50"
              >
                Depósito interno
              </button>
            )}
            <button
              type="button"
              disabled={!contaAtiva}
              onClick={() => setSaqueAberto(true)}
              className="rounded-md bg-black/10 px-3 py-1.5 text-xs font-medium transition hover:bg-black/15 disabled:opacity-50"
            >
              Sacar
            </button>
          </div>
        </Painel>

        {/* Totais + KPIs densos */}
        <Painel className="p-4 sm:p-5 lg:col-span-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide opacity-50">
                Totais no período
              </p>
              <dl className="mt-2.5 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="opacity-60">Gerados</dt>
                  <dd className="font-display text-base font-semibold tabular-nums">
                    {brl(d?.totais.gerados ?? '0')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="opacity-60">Pagos</dt>
                  <dd className="font-display text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {brl(d?.totais.pagos ?? '0')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="opacity-60">MEDs</dt>
                  <dd className="font-display text-base font-semibold tabular-nums">
                    {brl(d?.totais.meds ?? '0')}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-ink-800/10 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-50">Ticket</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums leading-tight">
                  {brl(d?.ticketMedio ?? '0')}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-50">Conversão</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums leading-tight">
                  {conversaoPct}%
                </p>
                <p className="text-[10px] opacity-45">
                  {d?.aprovadasQtd ?? 0}/{d?.geradasQtd ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-50">Pagas</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums leading-tight">
                  {d?.aprovadasQtd ?? 0}
                </p>
              </div>
            </div>
          </div>
        </Painel>

        {/* Gráfico */}
        <Painel className="p-4 sm:p-5 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold">Faturamento</h2>
            <div className="flex items-center gap-3 text-[11px] opacity-70">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#38bdf8]" />
                Geradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                Aprovadas
              </span>
            </div>
          </div>
          <div className="mt-3 h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => brl(v).replace('R$ ', 'R$')}
                />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Line type="monotone" dataKey="geradas" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="aprovadas" stroke="#FFC107" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Painel>
      </div>

      {/* Transações recentes */}
      <Painel className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-800/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-display text-sm font-semibold">Transações recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-[10px] uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
              <tr>
                <th className="px-4 py-2 font-medium">Transação</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">Produto</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {d?.recentes.map((t) => (
                <tr
                  key={t.idTransacao}
                  className="border-b border-ink-800/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    #{t.idTransacao.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium leading-tight">{t.cliente}</p>
                    {t.clienteEmail && (
                      <p className="text-[11px] opacity-55">{t.clienteEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs opacity-65">
                    {new Date(t.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 font-medium tabular-nums">{brl(t.valor)}</td>
                  <td className="px-4 py-2.5">{t.produto}</td>
                  <td className={`px-4 py-2.5 text-xs font-medium ${CORES_STATUS[t.situacao] ?? ''}`}>
                    {t.situacao}
                  </td>
                </tr>
              ))}
              {!d?.recentes.length && (
                <tr>
                  <td className="px-4 py-6 text-sm opacity-60" colSpan={6}>
                    {painel.isLoading ? 'Carregando…' : 'Nenhuma transação ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Painel>

      {/* Administração — visão global */}
      {isAdmin && admin.data && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide opacity-50">
            Administração — visão global
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(
              [
                ['Usuários', String(admin.data.usuarios)],
                ['Clientes ativos', String(admin.data.clientesAtivos)],
                ['Transações', String(admin.data.transacoes)],
                ['Volume', brl(admin.data.volumeBruto)],
              ] as const
            ).map(([titulo, valor]) => (
              <Painel key={titulo} className="px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-wide opacity-50">{titulo}</p>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums">{valor}</p>
              </Painel>
            ))}
          </div>
          <Painel className="mt-2 p-4">
            <p className="mb-2 text-xs opacity-60">Volume 14 dias</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={admin.data.serie.map((s) => ({
                    dia: new Date(s.dia).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    }),
                    volume: Number(s.volume),
                  }))}
                >
                  <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={56} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Bar dataKey="volume" fill="#FFC107" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Painel>
        </section>
      )}

      {contaAtiva && token && (
        <>
          <DepositoModal
            open={depositoAberto}
            onClose={() => setDepositoAberto(false)}
            token={token}
          />
          <SaqueModal
            open={saqueAberto}
            onClose={() => setSaqueAberto(false)}
            token={token}
          />
        </>
      )}
    </Shell>
  );
}
