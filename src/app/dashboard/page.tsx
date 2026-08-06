'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Minus,
  Plus,
  Receipt,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Shell } from '@/components/shell';
import { BadgeSituacao } from '@/components/status';
import { DepositoModal, SaqueModal } from '@/components/conta-acoes';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

const RANGES = [
  { v: 'mes', label: 'Mês' },
  { v: '30d', label: '30 dias' },
  { v: '7d', label: '7 dias' },
  { v: '1d', label: 'Hoje' },
] as const;

type Painel = {
  range: string;
  periodo: { inicio: string; fim: string; dias: number };
  saldoDisponivel: string;
  totais: { gerados: string; pagos: string; meds: string };
  ticketMedio: string;
  conversao: number;
  geradasQtd: number;
  aprovadasQtd: number;
  anterior: {
    gerados: string;
    pagos: string;
    geradasQtd: number;
    aprovadasQtd: number;
    ticketMedio: string;
    conversao: number;
  };
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
      bloqueadoManual: string;
    } | null;
    /** Regras da conta que explicam cada saldo parado. */
    regras?: {
      diasLiberacaoSaldo: number;
      percentualReserva: string;
      diasRetencaoReserva: number;
      medBloqueiaSaldo: boolean;
    };
  };
};

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const data = (v: string | Date) =>
  new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Texto do período coberto pelos números da tela ("01/08 → 05/08 · 5 dias"). */
function rotuloPeriodo(p: Painel['periodo'] | undefined, range: string) {
  if (!p) return '';
  if (range === '1d') {
    const h = (v: string) =>
      new Date(v).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    return `${data(p.inicio)} ${h(p.inicio)} → ${data(p.fim)} ${h(p.fim)} · últimas 24h`;
  }
  return `${data(p.inicio)} → ${data(p.fim)} · ${p.dias} dias`;
}

/** Variação percentual entre o período atual e o anterior (null = sem base). */
function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual > 0 ? null : 0;
  return ((atual - anterior) / anterior) * 100;
}

function Variacao({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-45">
        <Minus className="h-3 w-3" strokeWidth={2.5} />
        sem base anterior
      </span>
    );
  }
  const zero = Math.abs(pct) < 0.05;
  const sobe = pct > 0;
  const Icone = zero ? Minus : sobe ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
        zero
          ? 'opacity-50'
          : sobe
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
      }`}
    >
      <Icone className="h-3 w-3" strokeWidth={2.5} />
      {zero ? '0%' : `${sobe ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`}
    </span>
  );
}

function rotuloSerie(ts: string, range: string) {
  if (range === '1d') {
    const h = ts.split('T')[1] ?? '0';
    return `${String(h).padStart(2, '0')}h`;
  }
  const [, m, d] = (ts.split('T')[0] ?? '').split('-');
  return `${d}/${Number(m) + 1}`;
}

function Painel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink-800/10 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900 ${className}`}
    >
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
} as const;

export default function DashboardPage() {
  const { token, pode } = useAuth();
  const [range, setRange] = useState<string>('1d');
  const [mostrarSaldo, setMostrarSaldo] = useState(true);
  const [saqueAberto, setSaqueAberto] = useState(false);
  const [depositoAberto, setDepositoAberto] = useState(false);

  const painel = useQuery({
    queryKey: ['painel-dashboard', range],
    enabled: !!token,
    queryFn: () => api<Painel>(`/painel/dashboard?range=${range}`, { token: token! }),
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
  const dias = d?.periodo?.dias ?? 1;
  const mediaDiaria = (Number(d?.totais.pagos ?? 0) / Math.max(dias, 1)).toFixed(2);

  const kpis = [
    {
      titulo: 'Gerados',
      valor: brl(d?.totais.gerados ?? '0'),
      detalhe: `${d?.geradasQtd ?? 0} cobranças`,
      anterior: `antes: ${brl(d?.anterior.gerados ?? '0')}`,
      pct: variacao(Number(d?.totais.gerados ?? 0), Number(d?.anterior.gerados ?? 0)),
      icone: Receipt,
    },
    {
      titulo: 'Pagos',
      valor: brl(d?.totais.pagos ?? '0'),
      detalhe: `${d?.aprovadasQtd ?? 0} vendas pagas · ${brl(mediaDiaria)}/dia`,
      anterior: `antes: ${brl(d?.anterior.pagos ?? '0')}`,
      pct: variacao(Number(d?.totais.pagos ?? 0), Number(d?.anterior.pagos ?? 0)),
      icone: CheckCircle2,
      destaque: true,
    },
    {
      titulo: 'Ticket médio',
      valor: brl(d?.ticketMedio ?? '0'),
      detalhe: 'por venda paga',
      anterior: `antes: ${brl(d?.anterior.ticketMedio ?? '0')}`,
      pct: variacao(
        Number(d?.ticketMedio ?? 0),
        Number(d?.anterior.ticketMedio ?? 0),
      ),
      icone: TrendingUp,
    },
    {
      titulo: 'Conversão',
      valor: `${conversaoPct}%`,
      detalhe: `${d?.aprovadasQtd ?? 0} de ${d?.geradasQtd ?? 0} cobranças`,
      anterior: `antes: ${((d?.anterior.conversao ?? 0) * 100)
        .toFixed(1)
        .replace('.', ',')}%`,
      pct: variacao((d?.conversao ?? 0) * 100, (d?.anterior.conversao ?? 0) * 100),
      icone: Target,
    },
  ];

  /**
   * As linhas de saldo parado só aparecem para quem TEM a regra ligada.
   *
   * Conta sem D+, sem reserva e sem bloqueio de MED nunca acumula nada nesses
   * baldes — mostrar três zeros fixos só levanta dúvida sobre dinheiro que não
   * existe. Se ainda houver saldo preso de uma regra desligada depois, a linha
   * continua aparecendo: esconder dinheiro do lojista seria pior.
   */
  const regras = d?.conta.regras;
  const retemPrazo = (regras?.diasLiberacaoSaldo ?? 0) > 0;
  const temReserva = Number(regras?.percentualReserva ?? 0) > 0;
  const medBloqueia = regras?.medBloqueiaSaldo ?? true;
  const pendente = Number(d?.conta.saldo?.pendente ?? 0);
  const reservado = Number(d?.conta.saldo?.reservado ?? 0);
  const bloqueadoMed = Number(d?.conta.saldo?.bloqueadoMed ?? 0);

  const detalheSaldo = [
    ...(retemPrazo || pendente > 0
      ? [
          {
            rotulo: 'A liberar',
            valor: d?.conta.saldo?.pendente ?? '0',
            icone: Clock,
            dica: retemPrazo
              ? `Vendas pagas aguardando a liberação em D+${regras?.diasLiberacaoSaldo}.`
              : 'Vendas pagas aguardando o prazo de liberação.',
          },
        ]
      : []),
    ...(temReserva || reservado > 0
      ? [
          {
            rotulo: 'Reservado',
            valor: d?.conta.saldo?.reservado ?? '0',
            icone: Lock,
            dica: temReserva
              ? `Reserva de garantia de ${regras?.percentualReserva}% das vendas, liberada ${
                  regras?.diasRetencaoReserva
                    ? `${regras.diasRetencaoReserva} dias após o pagamento`
                    : 'no prazo combinado'
                }.`
              : 'Reserva de garantia sobre as vendas.',
          },
        ]
      : []),
    ...(medBloqueia || bloqueadoMed > 0
      ? [
          {
            rotulo: 'Bloqueado MED',
            valor: d?.conta.saldo?.bloqueadoMed ?? '0',
            icone: ShieldAlert,
            dica: 'Retido por contestações (MED) em análise.',
          },
        ]
      : []),
    // Só aparece quando existe bloqueio — para não assustar quem nunca teve.
    ...(Number(d?.conta.saldo?.bloqueadoManual ?? 0) > 0
      ? [
          {
            rotulo: 'Bloqueado',
            valor: d?.conta.saldo?.bloqueadoManual ?? '0',
            icone: Lock,
            dica: 'Valor retido pela administração. Fale com o suporte.',
          },
        ]
      : []),
  ];

  return (
    <Shell>
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm opacity-60">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {rotuloPeriodo(d?.periodo, d?.range ?? range) || 'Visão geral das suas vendas.'}
          </p>
        </div>
        <div className="flex rounded-full border border-ink-800/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-ink-900">
          {RANGES.map((r) => (
            <button
              key={r.v}
              type="button"
              onClick={() => setRange(r.v)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                range === r.v
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Saldo + KPIs */}
      <div className="mt-5 grid gap-3 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-strong p-5 text-accent-foreground shadow-sm sm:p-6 lg:col-span-4">
          <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-black/10 blur-2xl" />

          <div className="relative">
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

            {/* Conta sem nenhuma retenção não ganha uma lista vazia com borda
                solta: ganha a explicação de que não existe saldo parado. */}
            {detalheSaldo.length === 0 ? (
              <p className="mt-4 border-t border-black/10 pt-3 text-xs opacity-75">
                Todo o valor das suas vendas cai direto no disponível.
              </p>
            ) : (
            <dl className="mt-4 space-y-1.5 border-t border-black/10 pt-3">
              {detalheSaldo.map((s) => (
                <div
                  key={s.rotulo}
                  title={s.dica}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <dt className="flex items-center gap-1.5 opacity-75">
                    <s.icone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    {s.rotulo}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {mostrarSaldo ? brl(s.valor) : '••••'}
                  </dd>
                </div>
              ))}
            </dl>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {pode(PERMISSOES.TRANSACOES_CRIAR) && (
                <button
                  type="button"
                  disabled={!contaAtiva}
                  onClick={() => setDepositoAberto(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-black/25 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Depósito
                </button>
              )}
              <button
                type="button"
                disabled={!contaAtiva}
                onClick={() => setSaqueAberto(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-black/25 disabled:opacity-50"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2.25} />
                Sacar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-8 xl:grid-cols-4">
          {kpis.map((k) => (
            <Painel key={k.titulo} className="flex flex-col justify-between p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide opacity-55">
                  {k.titulo}
                </p>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    k.destaque
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-accent/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <k.icone className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
              <div className="mt-3">
                <p
                  className={`font-display text-lg font-semibold tabular-nums leading-tight sm:text-xl ${
                    k.destaque ? 'text-emerald-600 dark:text-emerald-400' : ''
                  }`}
                >
                  {k.valor}
                </p>
                <p className="mt-0.5 text-[11px] opacity-50">{k.detalhe}</p>
                <div
                  className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-ink-800/5 pt-2 dark:border-white/5"
                  title={`Comparado com os ${dias === 1 ? 'mesmos' : dias} dia(s) anteriores`}
                >
                  <Variacao pct={k.pct} />
                  <span className="text-[10px] tabular-nums opacity-40">
                    {k.anterior}
                  </span>
                </div>
              </div>
            </Painel>
          ))}
        </div>

        {/* Gráfico */}
        <Painel className="p-4 sm:p-5 lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold">Vendas no período</h2>
              <p className="text-[11px] opacity-50">
                {rotuloPeriodo(d?.periodo, d?.range ?? range)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] opacity-70">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                Geradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-2)]" />
                Aprovadas
              </span>
            </div>
          </div>
          <div className="mt-3 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -14, right: 8, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillGeradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillAprovadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => brl(v).replace('R$ ', 'R$')}
                />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="geradas"
                  name="Geradas"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#fillGeradas)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="aprovadas"
                  name="Aprovadas"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#fillAprovadas)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Painel>
      </div>

      {/* Transações recentes */}
      <Painel className="mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-800/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-display text-sm font-semibold">Transações recentes</h2>
        </div>

        {/* Tabela — desktop */}
        <div className="hidden overflow-x-auto md:block">
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
                  className="border-b border-ink-800/5 transition last:border-0 hover:bg-ink-800/[0.02] dark:border-white/5 dark:hover:bg-white/[0.02]"
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
                  <td className="px-4 py-2.5">
                    <BadgeSituacao situacao={t.situacao} />
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

        {/* Cards — mobile */}
        <ul className="divide-y divide-ink-800/5 md:hidden dark:divide-white/5">
          {d?.recentes.map((t) => (
            <li key={t.idTransacao} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">{t.cliente}</p>
                  <p className="mt-0.5 truncate text-[11px] opacity-55">{t.produto}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{brl(t.valor)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] opacity-50">
                  {new Date(t.criadoEm).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <BadgeSituacao situacao={t.situacao} />
              </div>
            </li>
          ))}
          {!d?.recentes.length && (
            <li className="px-4 py-6 text-sm opacity-60">
              {painel.isLoading ? 'Carregando…' : 'Nenhuma transação ainda.'}
            </li>
          )}
        </ul>
      </Painel>

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
