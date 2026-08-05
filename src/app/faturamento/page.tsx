'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Lock, Trophy } from 'lucide-react';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Marco = {
  codigo: string;
  nome: string;
  meta: string;
  faixa: 'inicial' | 'intermediario' | 'avancado';
  descricao: string;
  desbloqueado: boolean;
  progresso: number;
};

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
  { anel: string; fundo: string; texto: string; barra: string; ponto: string }
> = {
  PRATA: {
    anel: 'ring-slate-400/35',
    fundo: 'from-slate-200/70 to-slate-400/30 dark:from-slate-500/20 dark:to-slate-300/10',
    texto: 'text-slate-700 dark:text-slate-200',
    barra: 'bg-slate-400',
    ponto: 'bg-slate-400',
  },
  OURO: {
    anel: 'ring-amber-400/45',
    fundo: 'from-amber-200/60 to-yellow-500/25 dark:from-amber-500/20 dark:to-yellow-400/10',
    texto: 'text-amber-900 dark:text-amber-200',
    barra: 'bg-amber-400',
    ponto: 'bg-amber-400',
  },
  PLATINA: {
    anel: 'ring-cyan-400/35',
    fundo: 'from-cyan-100/70 to-sky-300/30 dark:from-cyan-400/15 dark:to-sky-300/10',
    texto: 'text-cyan-900 dark:text-cyan-200',
    barra: 'bg-cyan-400',
    ponto: 'bg-cyan-400',
  },
  BLACK: {
    anel: 'ring-ink-800/25 dark:ring-white/20',
    fundo: 'from-ink-800/90 to-ink-950 dark:from-white/10 dark:to-white/5',
    texto: 'text-white',
    barra: 'bg-ink-800 dark:bg-white',
    ponto: 'bg-ink-800 dark:bg-white',
  },
  DIAMANTE: {
    anel: 'ring-violet-400/40',
    fundo: 'from-violet-200/60 to-fuchsia-400/25 dark:from-violet-500/20 dark:to-fuchsia-400/10',
    texto: 'text-violet-950 dark:text-violet-200',
    barra: 'bg-violet-400',
    ponto: 'bg-violet-400',
  },
};

function estilo(codigo: string) {
  return ESTILO_MARCO[codigo] ?? ESTILO_MARCO.PRATA;
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

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Faturamento
          </h1>
          <p className="mt-1 text-sm opacity-65">
            GMV processado e marcos de premiação.
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
          {/* Hero GMV compacto */}
          <div
            className={`mt-5 overflow-hidden rounded-xl bg-gradient-to-br ${hero.fundo} p-5 ring-1 ${hero.anel} sm:p-6`}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wider opacity-65 ${hero.texto}`}
                >
                  Volume bruto acumulado
                </p>
                <p
                  className={`mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl ${hero.texto}`}
                >
                  {brl(data.gmvAcumulado)}
                </p>
                <p className={`mt-1.5 text-xs opacity-65 ${hero.texto}`}>
                  {data.qtdPagas}{' '}
                  {data.qtdPagas === 1 ? 'venda paga' : 'vendas pagas'} · lifetime
                </p>
              </div>

              <div
                className={`flex items-center gap-2.5 rounded-lg bg-white/45 px-3.5 py-2.5 backdrop-blur dark:bg-black/25 ${hero.texto}`}
              >
                <Trophy className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-65">
                    Nível
                  </p>
                  <p className="font-display text-base font-semibold leading-tight">
                    {data.nivelAtual?.nome ?? 'Iniciante'}
                  </p>
                </div>
              </div>
            </div>

            {data.proximoMarco ? (
              <div className="mt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className={`text-xs sm:text-sm ${hero.texto}`}>
                    Próximo:{' '}
                    <span className="font-semibold">{data.proximoMarco.nome}</span>
                    <span className="opacity-60"> · {brl(data.proximoMarco.meta)}</span>
                  </p>
                  <p className={`text-[11px] font-medium tabular-nums opacity-75 ${hero.texto}`}>
                    Faltam {brl(data.proximoMarco.restante)} · {progressoPct}%
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${estilo(data.proximoMarco.codigo).barra}`}
                    style={{ width: `${progressoPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className={`mt-5 text-sm font-medium ${hero.texto}`}>
                Todos os marcos conquistados — topo da trilha Diamante.
              </p>
            )}
          </div>

          {/* Trilha horizontal / densa */}
          <div className="mt-6 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-sm font-semibold">Trilha de premiação</h2>
            <p className="text-[11px] opacity-50">Prata → Diamante</p>
          </div>

          {/* Stepper desktop */}
          <ol
            className="mt-4 hidden gap-2 md:grid"
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
                  className={`relative flex flex-col rounded-xl border p-3.5 transition ${
                    m.desbloqueado
                      ? `border-transparent bg-gradient-to-b ${e.fundo} ring-1 ${e.anel}`
                      : atual
                        ? 'border-accent/35 bg-accent/5 dark:bg-accent/10'
                        : 'border-ink-800/10 bg-white opacity-75 dark:border-white/10 dark:bg-ink-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 ${
                        m.desbloqueado
                          ? `${e.anel} bg-white/55 dark:bg-black/30`
                          : atual
                            ? 'bg-accent/20 ring-accent/40'
                            : 'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10'
                      }`}
                    >
                      {m.desbloqueado ? (
                        <Check className={`h-4 w-4 ${e.texto}`} aria-hidden />
                      ) : atual ? (
                        <Trophy className="h-4 w-4 text-accent" aria-hidden />
                      ) : (
                        <Lock className="h-3.5 w-3.5 opacity-40" aria-hidden />
                      )}
                    </span>
                    {(m.desbloqueado || atual) && (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide ${
                          m.desbloqueado
                            ? `${e.texto} opacity-70`
                            : 'text-accent'
                        }`}
                      >
                        {m.desbloqueado ? 'Ok' : 'Agora'}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-2.5 font-display text-sm font-semibold leading-tight ${
                      m.desbloqueado ? e.texto : ''
                    }`}
                  >
                    {m.nome}
                  </p>
                  <p
                    className={`mt-0.5 text-[11px] tabular-nums ${
                      m.desbloqueado ? `${e.texto} opacity-70` : 'opacity-55'
                    }`}
                  >
                    {brlCurto(m.meta)}
                  </p>

                  {!m.desbloqueado && (
                    <div className="mt-auto pt-3">
                      <div className="h-1 overflow-hidden rounded-full bg-ink-800/10 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${e.barra}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] tabular-nums opacity-45">{pct}%</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Lista compacta mobile */}
          <ol className="mt-4 space-y-2 md:hidden">
            {data.marcos.map((m) => {
              const e = estilo(m.codigo);
              const atual =
                !m.desbloqueado && data.proximoMarco?.codigo === m.codigo;
              const pct = Math.round(m.progresso * 100);

              return (
                <li
                  key={m.codigo}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                    m.desbloqueado
                      ? `border-transparent bg-gradient-to-r ${e.fundo} ring-1 ${e.anel}`
                      : atual
                        ? 'border-accent/35 bg-accent/5 dark:bg-accent/10'
                        : 'border-ink-800/10 bg-white opacity-80 dark:border-white/10 dark:bg-ink-900'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${
                      m.desbloqueado
                        ? `${e.anel} bg-white/55 dark:bg-black/30`
                        : atual
                          ? 'bg-accent/20 ring-accent/40'
                          : 'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10'
                    }`}
                  >
                    {m.desbloqueado ? (
                      <Check className={`h-4 w-4 ${e.texto}`} aria-hidden />
                    ) : atual ? (
                      <Trophy className="h-4 w-4 text-accent" aria-hidden />
                    ) : (
                      <Lock className="h-3.5 w-3.5 opacity-40" aria-hidden />
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
                    </div>
                    {!m.desbloqueado && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800/10 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full ${e.barra}`}
                            style={{ width: `${pct}%` }}
                          />
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
