'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ContaAcoes, SaqueModal } from '@/components/conta-acoes';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

function Cartao({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-800/10 bg-white p-5 dark:border-white/10 dark:bg-ink-900 ${className}`}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { token, usuario } = useAuth();
  const isAdmin = usuario?.papeis.includes('ADMINISTRADOR');
  const [range, setRange] = useState<string>('1d');
  const [mostrarSaldo, setMostrarSaldo] = useState(true);
  const [saqueAberto, setSaqueAberto] = useState(false);

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

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm opacity-70">Visão geral da sua operação.</p>
        </div>
      </div>

      {/* ===== Faturamento ===== */}
      <Cartao className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Faturamento</h2>
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => setRange(r.v)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
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
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
            Geradas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            Aprovadas
          </span>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={64}
                tickFormatter={(v) => brl(v).replace('R$ ', 'R$')} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Line type="monotone" dataKey="geradas" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="aprovadas" stroke="#FFC107" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Cartao>

      {/* ===== Saldo + Totais ===== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Saldo hero */}
        <Cartao className="bg-gradient-to-br from-accent to-accent-strong text-accent-foreground lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm opacity-80">Saldo disponível</p>
            <button
              type="button"
              aria-label={mostrarSaldo ? 'Ocultar saldo' : 'Mostrar saldo'}
              onClick={() => setMostrarSaldo((v) => !v)}
              className="text-lg opacity-80 hover:opacity-100"
            >
              {mostrarSaldo ? '🙈' : '👁'}
            </button>
          </div>
          <p className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
            {mostrarSaldo ? brl(d?.saldoDisponivel ?? '0') : 'R$ ••••'}
          </p>
          <p className="mt-1 text-xs opacity-70">
            Bloqueado MED: {mostrarSaldo ? brl(d?.totais.meds ?? '0') : '••••'}
          </p>
          <button
            type="button"
            disabled={!contaAtiva}
            onClick={() => setSaqueAberto(true)}
            className="mt-4 rounded-lg bg-black/10 px-4 py-2 text-sm font-medium transition hover:bg-black/15 disabled:opacity-50"
          >
            Sacar
          </button>
        </Cartao>

        {/* Total transações */}
        <Cartao>
          <p className="text-sm font-medium opacity-70">Total de transações</p>
          <p className="text-xs opacity-50">no período</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="opacity-70">Gerados</dt>
              <dd className="font-semibold">{brl(d?.totais.gerados ?? '0')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="opacity-70">Pagos</dt>
              <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                {brl(d?.totais.pagos ?? '0')}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="opacity-70">MEDs</dt>
              <dd className="font-semibold">{brl(d?.totais.meds ?? '0')}</dd>
            </div>
          </dl>
        </Cartao>
      </div>

      {/* ===== KPIs ===== */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Cartao>
          <p className="text-xs uppercase tracking-wide opacity-60">Ticket médio</p>
          <p className="mt-2 font-display text-2xl">{brl(d?.ticketMedio ?? '0')}</p>
        </Cartao>
        <Cartao>
          <p className="text-xs uppercase tracking-wide opacity-60">Conversão</p>
          <p className="mt-2 font-display text-2xl">
            {((d?.conversao ?? 0) * 100).toFixed(1).replace('.', ',')}%
          </p>
          <p className="text-xs opacity-50">
            {d?.aprovadasQtd ?? 0}/{d?.geradasQtd ?? 0} pagas
          </p>
        </Cartao>
        <Cartao>
          <p className="text-xs uppercase tracking-wide opacity-60">Transações pagas</p>
          <p className="mt-2 font-display text-2xl">{d?.aprovadasQtd ?? 0}</p>
        </Cartao>
      </div>

      {/* ===== Transações recentes ===== */}
      <Cartao className="mt-4 p-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Transações recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-y border-ink-800/10 bg-ink-800/[0.03] text-xs uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
              <tr>
                <th className="px-5 py-2.5 font-medium">Transação</th>
                <th className="px-5 py-2.5 font-medium">Cliente</th>
                <th className="px-5 py-2.5 font-medium">Data</th>
                <th className="px-5 py-2.5 font-medium">Valor</th>
                <th className="px-5 py-2.5 font-medium">Produto</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {d?.recentes.map((t) => (
                <tr
                  key={t.idTransacao}
                  className="border-b border-ink-800/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-5 py-3 font-mono text-xs">
                    #{t.idTransacao.slice(0, 8)}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{t.cliente}</p>
                    {t.clienteEmail && (
                      <p className="text-xs opacity-60">{t.clienteEmail}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs opacity-70">
                    {new Date(t.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 font-medium">{brl(t.valor)}</td>
                  <td className="px-5 py-3">{t.produto}</td>
                  <td className={`px-5 py-3 text-xs font-medium ${CORES_STATUS[t.situacao] ?? ''}`}>
                    {t.situacao}
                  </td>
                </tr>
              ))}
              {!d?.recentes.length && (
                <tr>
                  <td className="px-5 py-8 text-sm opacity-60" colSpan={6}>
                    {painel.isLoading ? 'Carregando…' : 'Nenhuma transação ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>

      {/* ===== Minha conta (ações: depositar / sacar / credencial) ===== */}
      {d?.conta && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Minha conta
          </h2>
          <div className="mt-3 rounded-xl border border-ink-800/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-ink-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{d.conta.nome}</span>
              <span className="text-xs opacity-60">{d.conta.situacao}</span>
            </div>
            {d.conta.saldo && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs opacity-60">Disponível</p>
                  <p className="font-medium">{brl(d.conta.saldo.disponivel)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-60">A liberar</p>
                  <p className="font-medium">{brl(d.conta.saldo.pendente)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-60">Reservado</p>
                  <p className="font-medium">{brl(d.conta.saldo.reservado)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-60">Bloqueado MED</p>
                  <p className="font-medium">{brl(d.conta.saldo.bloqueadoMed)}</p>
                </div>
              </div>
            )}
            <ContaAcoes ativa={contaAtiva} />
          </div>
        </section>
      )}

      {/* ===== Administração — visão global ===== */}
      {isAdmin && admin.data && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Administração — visão global
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Cartao>
              <p className="text-xs uppercase tracking-wide opacity-60">Usuários</p>
              <p className="mt-2 font-display text-2xl">{admin.data.usuarios}</p>
            </Cartao>
            <Cartao>
              <p className="text-xs uppercase tracking-wide opacity-60">Clientes ativos</p>
              <p className="mt-2 font-display text-2xl">{admin.data.clientesAtivos}</p>
            </Cartao>
            <Cartao>
              <p className="text-xs uppercase tracking-wide opacity-60">Transações</p>
              <p className="mt-2 font-display text-2xl">{admin.data.transacoes}</p>
            </Cartao>
            <Cartao>
              <p className="text-xs uppercase tracking-wide opacity-60">Volume</p>
              <p className="mt-2 font-display text-2xl">{brl(admin.data.volumeBruto)}</p>
            </Cartao>
          </div>
          <Cartao className="mt-4 h-72">
            <p className="mb-4 text-sm opacity-70">Volume 14 dias</p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart
                data={admin.data.serie.map((s) => ({
                  dia: new Date(s.dia).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  }),
                  volume: Number(s.volume),
                }))}
              >
                <XAxis dataKey="dia" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="volume" fill="#FFC107" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </Cartao>
        </section>
      )}

      {/* Modal de saque a partir do card hero */}
      {contaAtiva && token && (
        <SaqueModal
          open={saqueAberto}
          onClose={() => setSaqueAberto(false)}
          token={token}
        />
      )}
    </Shell>
  );
}
