'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Crown,
  Flame,
  Lock,
  Receipt,
  Rocket,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { diasRestantesNoMesBrasilia, FUSO_BRASILIA } from '@/lib/fuso';

type Marco = {
  codigo: string;
  nome: string;
  meta: string;
  faixa: 'inicial' | 'intermediario' | 'avancado';
  descricao: string;
  desbloqueado: boolean;
  progresso: number;
};

type Mes = { mes: string; valor: string; qtd: number };

type Faturamento = {
  gmvAcumulado: string;
  qtdPagas: number;
  nivelAtual: { codigo: string; nome: string; meta: string } | null;
  proximoMarco: {
    codigo: string;
    nome: string;
    meta: string;
    restante: string;
    progresso: number;
  } | null;
  marcos: Marco[];
  ticketMedio: string;
  primeiraVenda: string | null;
  diasOperando: number;
  mediaDiaria: string;
  mensal: Mes[];
  mesAtual?: Mes;
  mesAnterior?: Mes;
  melhorMes?: Mes;
};

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const brlCurto = (v: string | number) => {
  const n = Number(v);
  if (n >= 1_000_000) {
    return (
      'R$ ' +
      (n / 1_000_000).toLocaleString('pt-BR', {
        maximumFractionDigits: n % 1_000_000 === 0 ? 0 : 1,
      }) +
      ' mi'
    );
  }
  if (n >= 1_000) {
    return (
      'R$ ' +
      (n / 1_000).toLocaleString('pt-BR', {
        maximumFractionDigits: n % 1_000 === 0 ? 0 : 1,
      }) +
      ' mil'
    );
  }
  return brl(n);
};

const ESTILO_MARCO: Record<
  string,
  { anel: string; fundo: string; texto: string; barra: string; brilho: string }
> = {
  PRATA: {
    anel: 'ring-slate-400/40',
    fundo: 'from-slate-200/80 to-slate-400/35 dark:from-slate-500/25 dark:to-slate-300/10',
    texto: 'text-slate-700 dark:text-slate-200',
    barra: 'bg-slate-400',
    brilho: 'bg-slate-300/50',
  },
  OURO: {
    anel: 'ring-amber-400/50',
    fundo: 'from-amber-200/70 to-yellow-500/30 dark:from-amber-500/25 dark:to-yellow-400/10',
    texto: 'text-amber-900 dark:text-amber-200',
    barra: 'bg-amber-400',
    brilho: 'bg-amber-300/50',
  },
  PLATINA: {
    anel: 'ring-cyan-400/40',
    fundo: 'from-cyan-100/80 to-sky-300/35 dark:from-cyan-400/20 dark:to-sky-300/10',
    texto: 'text-cyan-900 dark:text-cyan-200',
    barra: 'bg-cyan-400',
    brilho: 'bg-cyan-300/50',
  },
  BLACK: {
    anel: 'ring-ink-800/30 dark:ring-white/25',
    fundo: 'from-ink-800/95 to-ink-950 dark:from-white/15 dark:to-white/5',
    texto: 'text-white',
    barra: 'bg-ink-800 dark:bg-white',
    brilho: 'bg-white/20',
  },
  DIAMANTE: {
    anel: 'ring-violet-400/45',
    fundo: 'from-violet-200/70 to-fuchsia-400/30 dark:from-violet-500/25 dark:to-fuchsia-400/10',
    texto: 'text-violet-950 dark:text-violet-200',
    barra: 'bg-violet-400',
    brilho: 'bg-violet-300/50',
  },
};

function estilo(codigo: string) {
  return ESTILO_MARCO[codigo] ?? ESTILO_MARCO.PRATA;
}

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** '2026-08' → 'ago/26' */
function rotuloMes(mes: string) {
  const [ano, m] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${ano.slice(2)}`;
}

function variacaoMes(atual?: Mes, anterior?: Mes): number | null {
  const a = Number(atual?.valor ?? 0);
  const b = Number(anterior?.valor ?? 0);
  if (!b) return a > 0 ? null : 0;
  return ((a - b) / b) * 100;
}

function fraseMotivacional(pct: number, qtdPagas: number, proximoNome?: string) {
  if (!proximoNome) return 'Você chegou ao topo. Lenda do PIX. 👑';
  if (pct >= 90) return `Reta final! O nível ${proximoNome} já está ao seu alcance.`;
  if (pct >= 60) return 'Você está voando — mantenha o ritmo e a próxima conquista é sua.';
  if (pct >= 30) return 'Boa! Cada venda aprovada te deixa mais perto do próximo nível.';
  if (qtdPagas > 0)
    return `Começou a subida rumo ao ${proximoNome} — cada venda conta a partir daqui.`;
  return 'Toda grande operação começa com as primeiras vendas. Acelera!';
}

function BarraProgresso({
  pct,
  barra,
  altura = 'h-2.5',
}: {
  pct: number;
  barra: string;
  altura?: string;
}) {
  return (
    <div
      className={`relative ${altura} overflow-hidden rounded-full bg-black/10 dark:bg-white/10`}
    >
      <div
        className={`relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out ${barra}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      >
        <span className="animate-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
    </div>
  );
}

export default function FaturamentoPage() {
  const { token } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['painel-faturamento'],
    enabled: !!token,
    queryFn: () => api<Faturamento>('/painel/faturamento', { token: token! }),
  });

  const progressoPct = Math.round((data?.proximoMarco?.progresso ?? 0) * 100);
  const nivelCodigo = data?.nivelAtual?.codigo ?? data?.proximoMarco?.codigo ?? 'PRATA';
  const hero = estilo(nivelCodigo);
  const conquistados = data?.marcos.filter((m) => m.desbloqueado).length ?? 0;
  const varMes = variacaoMes(data?.mesAtual, data?.mesAnterior);
  const serieMensal =
    data?.mensal.map((m) => ({
      mes: rotuloMes(m.mes),
      valor: Number(m.valor),
      qtd: m.qtd,
    })) ?? [];

  /**
   * Meta de ritmo. Só sugere fechar no mês quando isso cabe no ritmo atual
   * (até 2×) — pedir 12 mil/dia para quem faz 500/dia desanima em vez de
   * incentivar. Fora disso, mostra a projeção pelo ritmo que ele já tem.
   */
  const ritmo = (() => {
    if (!data?.proximoMarco) return null;
    const restante = Number(data.proximoMarco.restante);
    const media = Number(data.mediaDiaria);
    const hoje = new Date();
    const diasRestantes = diasRestantesNoMesBrasilia(hoje);
    const porDia = restante / diasRestantes;

    if (media > 0 && porDia <= media * 2) {
      return {
        tipo: 'mes' as const,
        texto: `Para conquistar ainda este mês: ${brl(porDia)} por dia nos próximos ${diasRestantes} dias`,
      };
    }
    if (media > 0) {
      const diasNecessarios = Math.ceil(restante / media);
      const alvo = new Date(hoje.getTime() + diasNecessarios * 86_400_000);
      return {
        tipo: 'projecao' as const,
        texto: `No seu ritmo atual (${brl(media)}/dia), você chega ao ${data.proximoMarco.nome} em ${alvo.toLocaleDateString(
          'pt-BR',
          { timeZone: FUSO_BRASILIA, month: 'long', year: 'numeric' },
        )} — acelere e antecipe essa data`,
      };
    }
    return null;
  })();

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Faturamento
          </h1>
          <p className="mt-1 text-sm opacity-65">
            Sua trilha de conquistas — quanto mais você vende, mais alto você chega.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="mt-6 text-sm opacity-60">Carregando faturamento…</p>
      )}
      {isError && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Não foi possível carregar o faturamento.
        </p>
      )}

      {data && (
        <>
          {/* Hero — palco do GMV */}
          <div
            className={`relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br ${hero.fundo} p-5 shadow-sm ring-1 ${hero.anel} sm:p-7`}
          >
            <div
              className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl ${hero.brilho}`}
            />
            <div
              className={`pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full blur-3xl ${hero.brilho}`}
            />

            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p
                  className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-70 ${hero.texto}`}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Você já processou
                </p>
                <p
                  className={`mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl ${hero.texto}`}
                >
                  {brl(data.gmvAcumulado)}
                </p>
                <p className={`mt-2 flex items-center gap-1.5 text-xs opacity-70 ${hero.texto}`}>
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  {data.qtdPagas}{' '}
                  {data.qtdPagas === 1 ? 'venda aprovada' : 'vendas aprovadas'} · desde o início
                </p>
              </div>

              <div
                className={`flex items-center gap-3 rounded-2xl bg-white/50 px-4 py-3 shadow-sm ring-1 backdrop-blur ${hero.anel} dark:bg-black/30 ${hero.texto}`}
              >
                <span className="animate-glow flex h-11 w-11 items-center justify-center rounded-full bg-white/60 ring-1 ring-black/5 dark:bg-black/30 dark:ring-white/10">
                  {data.nivelAtual ? (
                    <Trophy className="h-6 w-6 opacity-90" aria-hidden />
                  ) : (
                    <Rocket className="h-6 w-6 opacity-90" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-65">
                    Seu nível
                  </p>
                  <p className="font-display text-lg font-semibold leading-tight">
                    {data.nivelAtual?.nome ?? 'Decolando'}
                  </p>
                  <p className="text-[10px] tabular-nums opacity-60">
                    {conquistados} de {data.marcos.length} marcos conquistados
                  </p>
                </div>
              </div>
            </div>

            {data.proximoMarco ? (
              <div className="relative mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`text-sm font-medium ${hero.texto}`}>
                    Próxima conquista:{' '}
                    <span className="font-display font-semibold">
                      {data.proximoMarco.nome}
                    </span>
                    <span className="opacity-60"> · {brlCurto(data.proximoMarco.meta)}</span>
                  </p>
                  <p
                    className={`text-xs font-semibold tabular-nums ${hero.texto}`}
                  >
                    faltam {brl(data.proximoMarco.restante)}
                  </p>
                </div>
                <div className="mt-2.5">
                  <BarraProgresso
                    pct={progressoPct}
                    barra={estilo(data.proximoMarco.codigo).barra}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={`text-xs opacity-75 ${hero.texto}`}>
                    {fraseMotivacional(
                      progressoPct,
                      data.qtdPagas,
                      data.proximoMarco.nome,
                    )}
                  </p>
                  <p className={`text-xs font-bold tabular-nums ${hero.texto}`}>
                    {progressoPct}% até {data.proximoMarco.nome}
                  </p>
                </div>
                {ritmo && (
                  <p
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[11px] font-medium dark:bg-black/25 ${hero.texto}`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {ritmo.texto}
                  </p>
                )}
              </div>
            ) : (
              <p
                className={`relative mt-6 flex items-center gap-2 text-sm font-semibold ${hero.texto}`}
              >
                <Crown className="h-4 w-4" aria-hidden />
                Todos os marcos conquistados — você está no topo da trilha Diamante.
              </p>
            )}
          </div>

          {/* Números da operação */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                titulo: 'Este mês',
                valor: brl(data.mesAtual?.valor ?? '0'),
                detalhe: `${data.mesAtual?.qtd ?? 0} vendas · antes ${brlCurto(
                  data.mesAnterior?.valor ?? '0',
                )}`,
                icone: CalendarDays,
                pct: varMes,
              },
              {
                titulo: 'Média por dia',
                valor: brl(data.mediaDiaria),
                detalhe:
                  data.diasOperando > 0
                    ? `em ${data.diasOperando} dias de operação`
                    : 'sem vendas ainda',
                icone: Flame,
              },
              {
                titulo: 'Ticket médio',
                valor: brl(data.ticketMedio),
                detalhe: `${data.qtdPagas} vendas aprovadas`,
                icone: Receipt,
              },
              {
                titulo: 'Melhor mês',
                valor: brl(data.melhorMes?.valor ?? '0'),
                detalhe: data.melhorMes
                  ? `${rotuloMes(data.melhorMes.mes)} · ${data.melhorMes.qtd} vendas`
                  : '—',
                icone: Trophy,
                destaque: true,
              },
            ].map((c) => (
              <div
                key={c.titulo}
                className="flex flex-col justify-between rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide opacity-55">
                    {c.titulo}
                  </p>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      c.destaque
                        ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                        : 'bg-accent/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <c.icone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="font-display text-lg font-semibold tabular-nums leading-tight sm:text-xl">
                    {c.valor}
                  </p>
                  <p className="mt-0.5 text-[11px] opacity-50">{c.detalhe}</p>
                  {c.pct !== undefined && (
                    <p
                      className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
                        c.pct === null
                          ? 'opacity-45'
                          : c.pct >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {c.pct === null ? null : c.pct >= 0 ? (
                        <TrendingUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                      ) : (
                        <TrendingDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                      )}
                      {c.pct === null
                        ? 'primeiro mês com vendas'
                        : `${c.pct >= 0 ? '+' : ''}${c.pct
                            .toFixed(1)
                            .replace('.', ',')}% vs. mês anterior`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Evolução mensal */}
          <div className="mt-3 rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm sm:p-5 dark:border-white/10 dark:bg-ink-900">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">
                Sua evolução mês a mês
              </h2>
              <p className="text-[11px] opacity-50">Últimos 12 meses · valor aprovado</p>
            </div>
            <div className="mt-3 h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={serieMensal}
                  margin={{ left: -14, right: 8, top: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v) => brlCurto(v)}
                  />
                  <Tooltip
                    formatter={(v, _n, item) => [
                      `${brl(Number(v))} · ${item?.payload?.qtd ?? 0} vendas`,
                      'Faturamento',
                    ]}
                    contentStyle={{
                      background: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  />
                  <Bar
                    dataKey="valor"
                    name="Faturamento"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trilha */}
          <div className="mt-7 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Trilha de premiação</h2>
            <p className="text-[11px] opacity-50">Prata → Diamante</p>
          </div>

          {/* Stepper desktop */}
          <ol
            className="mt-4 hidden gap-3 md:grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(data.marcos.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {data.marcos.map((m) => {
              const e = estilo(m.codigo);
              const atual =
                !m.desbloqueado && data.proximoMarco?.codigo === m.codigo;
              const pct = Math.round(m.progresso * 100);

              return (
                <li
                  key={m.codigo}
                  title={m.descricao}
                  className={`relative flex flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    m.desbloqueado
                      ? `border-transparent bg-gradient-to-b ${e.fundo} shadow-sm ring-1 ${e.anel}`
                      : atual
                        ? 'animate-glow border-accent/40 bg-accent/5 shadow-sm dark:bg-accent/10'
                        : 'border-ink-800/10 bg-white opacity-70 dark:border-white/10 dark:bg-ink-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                        m.desbloqueado
                          ? `${e.anel} bg-white/60 dark:bg-black/30`
                          : atual
                            ? 'bg-accent/20 ring-accent/40'
                            : 'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10'
                      }`}
                    >
                      {m.desbloqueado ? (
                        <Check className={`h-5 w-5 ${e.texto}`} aria-hidden />
                      ) : atual ? (
                        <Trophy className="h-5 w-5 text-accent" aria-hidden />
                      ) : (
                        <Lock className="h-4 w-4 opacity-40" aria-hidden />
                      )}
                    </span>
                    {(m.desbloqueado || atual) && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          m.desbloqueado
                            ? `bg-white/45 dark:bg-black/25 ${e.texto}`
                            : 'bg-accent/15 text-accent'
                        }`}
                      >
                        {m.desbloqueado ? 'Conquistado' : 'Em disputa'}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-3 font-display text-base font-semibold leading-tight ${
                      m.desbloqueado ? e.texto : ''
                    }`}
                  >
                    {m.nome}
                  </p>
                  <p
                    className={`mt-0.5 text-xs tabular-nums ${
                      m.desbloqueado ? `${e.texto} opacity-70` : 'opacity-55'
                    }`}
                  >
                    {brlCurto(m.meta)}
                  </p>

                  {!m.desbloqueado && (
                    <div className="mt-auto pt-4">
                      {atual ? (
                        <BarraProgresso pct={pct} barra={e.barra} altura="h-1.5" />
                      ) : (
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink-800/10 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${e.barra}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      <p className="mt-1.5 text-[10px] font-medium tabular-nums opacity-50">
                        {pct}% da meta
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Lista compacta mobile */}
          <ol className="mt-4 space-y-2.5 md:hidden">
            {data.marcos.map((m) => {
              const e = estilo(m.codigo);
              const atual =
                !m.desbloqueado && data.proximoMarco?.codigo === m.codigo;
              const pct = Math.round(m.progresso * 100);

              return (
                <li
                  key={m.codigo}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                    m.desbloqueado
                      ? `border-transparent bg-gradient-to-r ${e.fundo} shadow-sm ring-1 ${e.anel}`
                      : atual
                        ? 'animate-glow border-accent/40 bg-accent/5 shadow-sm dark:bg-accent/10'
                        : 'border-ink-800/10 bg-white opacity-75 dark:border-white/10 dark:bg-ink-900'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
                      m.desbloqueado
                        ? `${e.anel} bg-white/60 dark:bg-black/30`
                        : atual
                          ? 'bg-accent/20 ring-accent/40'
                          : 'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10'
                    }`}
                  >
                    {m.desbloqueado ? (
                      <Check className={`h-5 w-5 ${e.texto}`} aria-hidden />
                    ) : atual ? (
                      <Trophy className="h-5 w-5 text-accent" aria-hidden />
                    ) : (
                      <Lock className="h-4 w-4 opacity-40" aria-hidden />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p
                        className={`font-display text-sm font-semibold ${
                          m.desbloqueado ? e.texto : ''
                        }`}
                      >
                        {m.nome}
                      </p>
                      <span
                        className={`text-[10px] tabular-nums ${
                          m.desbloqueado ? `${e.texto} opacity-70` : 'opacity-50'
                        }`}
                      >
                        {brlCurto(m.meta)}
                      </span>
                      {m.desbloqueado && (
                        <span
                          className={`rounded-full bg-white/45 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide dark:bg-black/25 ${e.texto}`}
                        >
                          Conquistado
                        </span>
                      )}
                    </div>
                    {!m.desbloqueado && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1">
                          {atual ? (
                            <BarraProgresso pct={pct} barra={e.barra} altura="h-1.5" />
                          ) : (
                            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800/10 dark:bg-white/10">
                              <div
                                className={`h-full rounded-full ${e.barra}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] tabular-nums opacity-45">{pct}%</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Shell>
  );
}
