'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Shield,
  Wallet,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  FiltroData,
  FiltroSelect,
  FiltroTexto,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { hojeISO } from '@/lib/fuso';
import { useAuth } from '@/lib/auth';

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '%';

const qtd = (v: number) => v.toLocaleString('pt-BR');

const diasEntre = (ini: string, fim: string) => {
  const a = Date.parse(ini + 'T00:00:00Z');
  const b = Date.parse(fim + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.floor((b - a) / 86_400_000) + 1;
};

type BlocoValor = { valor: string; qtd: number; pct: string };
type Metricas = {
  aguardando: BlocoValor;
  pagas: BlocoValor;
  retidas: BlocoValor;
  medEmRetidas: BlocoValor;
  med: BlocoValor;
  medsRetidos: BlocoValor;
  totalRecebido: { valor: string; pct: string };
  taxaConversao: string;
  taxaConversaoReal: string;
  conversaoTransacao: string;
  pctRetidas: string;
  pctMed: string;
};

type StatusTempo = {
  minutosPagas: number | null;
  minutosAguardando: number | null;
  tevePagaNoPeriodo: boolean;
  teveAguardandoNoPeriodo: boolean;
};

type LinhaAdq = Metricas & {
  codigo: string;
  nome: string;
  statusTempo: StatusTempo;
};

type LinhaUser = Metricas & {
  idPublico: string;
  nome: string;
  email: string;
};

type Relatorio = {
  filtros: {
    dataInicial: string;
    dataFinal: string;
    adquirente: string | null;
    usuario: string | null;
    ocultarRetidas: boolean;
  };
  diasPeriodo: number;
  saude: {
    pagas: { ultimos2min: number; ultimos4min: number; minutosDesdeUltima: number | null; nivel: string };
    aguardando: { ultimos2min: number; ultimos4min: number; minutosDesdeUltima: number | null; nivel: string };
    mensagemPagas: string;
    mensagemAguardando: string;
  };
  geral: Metricas;
  filtrado: Metricas | null;
  porAdquirente: LinhaAdq[];
  porUsuario: LinhaUser[];
  porUsuarioFiltrado: LinhaUser[] | null;
  grafico: {
    granularidade: string;
    pontos: Array<{ em: string; label: string; faturamento: string; med: string }>;
  } | null;
};

function BannerSaude({
  tipo,
  nivel,
  mensagem,
}: {
  tipo: 'pagas' | 'aguardando';
  nivel: string;
  mensagem: string;
}) {
  const ok = nivel === 'ok';
  const alerta = nivel === 'alerta';
  const bg = ok
    ? 'border-emerald-500/25 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
    : alerta
      ? 'border-amber-500/30 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
      : 'border-red-500/30 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100';
  const Icon = ok ? CheckCircle2 : tipo === 'pagas' ? AlertTriangle : Clock;
  const iconColor = ok
    ? 'text-emerald-600'
    : alerta
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${bg}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} strokeWidth={1.75} />
      <p>{mensagem}</p>
    </div>
  );
}

function CardKpi({
  titulo,
  valor,
  percentual,
  tom,
  icone: Icon,
}: {
  titulo: string;
  valor: string;
  percentual: string;
  tom: 'amber' | 'emerald' | 'violet' | 'orange' | 'red' | 'purple' | 'sky';
  icone: typeof Wallet;
}) {
  const estilos: Record<typeof tom, { wrap: string; text: string }> = {
    amber: {
      wrap: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
      text: 'text-amber-700 dark:text-amber-300',
    },
    emerald: {
      wrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    violet: {
      wrap: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
      text: 'text-violet-700 dark:text-violet-300',
    },
    orange: {
      wrap: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
      text: 'text-orange-700 dark:text-orange-300',
    },
    red: {
      wrap: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
      text: 'text-red-700 dark:text-red-300',
    },
    purple: {
      wrap: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
      text: 'text-purple-700 dark:text-purple-300',
    },
    sky: {
      wrap: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
      text: 'text-sky-700 dark:text-sky-300',
    },
  };
  const e = estilos[tom];
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-800/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-ink-900">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.wrap}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-55">{titulo}</p>
        <p className={`mt-0.5 font-display text-base font-semibold tabular-nums sm:text-lg ${e.text}`}>
          {brl(valor)}
          <span className="ml-1 text-sm font-normal opacity-60">({pct(percentual)})</span>
        </p>
      </div>
    </div>
  );
}

function FaixaKpis({
  titulo,
  m,
  ocultarRetidas,
}: {
  titulo: string;
  m: Metricas;
  ocultarRetidas: boolean;
}) {
  return (
    <section className="rounded-xl border border-ink-800/10 bg-ink-800/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide">{titulo}</h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <CardKpi
          titulo="Aguardando"
          valor={m.aguardando.valor}
          percentual={m.aguardando.pct}
          tom="amber"
          icone={Clock}
        />
        <CardKpi
          titulo="Pagas"
          valor={m.pagas.valor}
          percentual={m.pagas.pct}
          tom="emerald"
          icone={CheckCircle2}
        />
        {!ocultarRetidas && (
          <>
            <CardKpi
              titulo="Retidas (método)"
              valor={m.retidas.valor}
              percentual={m.retidas.pct}
              tom="violet"
              icone={Lock}
            />
            <CardKpi
              titulo="MED em transações retidas"
              valor={m.medEmRetidas.valor}
              percentual={m.medEmRetidas.pct}
              tom="orange"
              icone={AlertTriangle}
            />
          </>
        )}
        <CardKpi
          titulo="MED"
          valor={m.med.valor}
          percentual={m.med.pct}
          tom="red"
          icone={AlertTriangle}
        />
        {!ocultarRetidas && (
          <CardKpi
            titulo="MEDs retidos (automático)"
            valor={m.medsRetidos.valor}
            percentual={m.medsRetidos.pct}
            tom="purple"
            icone={Shield}
          />
        )}
        <CardKpi
          titulo="Total recebido (pagas + retidas + MED)"
          valor={m.totalRecebido.valor}
          percentual={m.totalRecebido.pct}
          tom="sky"
          icone={Wallet}
        />
      </div>
    </section>
  );
}

function BadgeTempo({
  minutos,
  teveNoPeriodo,
  sentido,
}: {
  minutos: number | null;
  teveNoPeriodo: boolean;
  sentido: 'pagas' | 'aguardando';
}) {
  if (minutos == null) {
    return (
      <span className="inline-block rounded-md bg-ink-800/10 px-2 py-1 text-[11px] dark:bg-white/10">
        {sentido === 'pagas' ? 'Vendas não pagas no período' : 'Vendas não geradas no período'}
      </span>
    );
  }
  const nivel = minutos <= 2 ? 'ok' : minutos <= 4 ? 'alerta' : 'critico';
  const cls =
    nivel === 'ok'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
      : nivel === 'alerta'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
        : 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100';
  const label =
    sentido === 'pagas'
      ? `Vendas pagas há ${minutos} min.`
      : `Vendas não pagas há ${minutos} min.`;
  // Sem movimento no período filtrado, ainda mostramos o tempo real (saúde).
  void teveNoPeriodo;
  return <span className={`inline-block rounded-md px-2 py-1 text-[11px] ${cls}`}>{label}</span>;
}

function TabelaConversao({
  titulo,
  subtitulo,
  rows,
  modo,
  ocultarRetidas,
}: {
  titulo: string;
  subtitulo: string;
  rows: Array<Metricas & { chave: string; rotulo: string; statusTempo?: StatusTempo }>;
  modo: 'adquirente' | 'usuario';
  ocultarRetidas: boolean;
}) {
  return (
    <section className="mt-6 rounded-xl border border-ink-800/10 dark:border-white/10">
      <div className="border-b border-ink-800/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">{titulo}</h2>
        <p className="mt-0.5 text-xs opacity-55">{subtitulo}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-[11px] uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                {modo === 'adquirente' ? 'Adquirente' : 'Usuário'}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Aguardando</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Pagas</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Taxa conversão (%)</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                Taxa conversão — real (pagas + retidas) (%)
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Transações geradas</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Transações pagas</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Conversão transação (%)</th>
              {!ocultarRetidas && (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Retidas</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">% Retidas / pagas</th>
                </>
              )}
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Valor MED</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Percent MED (%)</th>
              {!ocultarRetidas && (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">MEDs retidos</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">Percent MEDs retidos (%)</th>
                </>
              )}
              {modo === 'adquirente' && (
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status tempo (pagas / aguard.)</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.chave} className="border-b border-ink-800/5 dark:border-white/5">
                <td className="px-3 py-2.5 font-medium">{r.rotulo}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{brl(r.aguardando.valor)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-emerald-700 dark:text-emerald-400">
                  {brl(r.pagas.valor)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{pct(r.taxaConversao)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{pct(r.taxaConversaoReal)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                  {qtd(r.aguardando.qtd + r.pagas.qtd + (ocultarRetidas ? 0 : r.retidas.qtd))}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{qtd(r.pagas.qtd)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{pct(r.conversaoTransacao)}</td>
                {!ocultarRetidas && (
                  <>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{brl(r.retidas.valor)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{pct(r.pctRetidas)}</td>
                  </>
                )}
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-red-700 dark:text-red-400">
                  {brl(r.med.valor)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{pct(r.pctMed)}</td>
                {!ocultarRetidas && (
                  <>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{brl(r.medsRetidos.valor)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {pct(r.medsRetidos.pct)}
                    </td>
                  </>
                )}
                {modo === 'adquirente' && r.statusTempo && (
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <BadgeTempo
                        minutos={r.statusTempo.minutosPagas}
                        teveNoPeriodo={r.statusTempo.tevePagaNoPeriodo}
                        sentido="pagas"
                      />
                      <BadgeTempo
                        minutos={r.statusTempo.minutosAguardando}
                        teveNoPeriodo={r.statusTempo.teveAguardandoNoPeriodo}
                        sentido="aguardando"
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-sm opacity-60">
                  Nenhum dado no período/filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RelatorioMetodoPage() {
  const { token } = useAuth();
  const [dataInicial, setDataInicial] = useState(hojeISO());
  const [dataFinal, setDataFinal] = useState(hojeISO());
  const [adquirente, setAdquirente] = useState('');
  const [usuario, setUsuario] = useState('');
  const [ocultarRetidas, setOcultarRetidas] = useState(false);

  // Filtros aplicados (só mudam no "Aplicar" / limpar) — página sobe rápida.
  const [aplicado, setAplicado] = useState({
    dataInicial: hojeISO(),
    dataFinal: hojeISO(),
    adquirente: '',
    usuario: '',
    ocultarRetidas: false,
  });

  const dias = diasEntre(aplicado.dataInicial, aplicado.dataFinal);
  const refetchMs = dias <= 15 ? 120_000 : false;

  const adquirentes = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!token,
    queryFn: () =>
      api<Array<{ codigo: string; nome: string }>>('/admin/provedores', { token: token! }),
  });

  const rel = useQuery({
    queryKey: ['rel-metodo', aplicado],
    enabled: !!token,
    refetchInterval: refetchMs,
    queryFn: () => {
      const p = new URLSearchParams({
        dataInicial: aplicado.dataInicial,
        dataFinal: aplicado.dataFinal,
      });
      if (aplicado.adquirente) p.set('adquirente', aplicado.adquirente);
      if (aplicado.usuario) p.set('usuario', aplicado.usuario);
      if (aplicado.ocultarRetidas) p.set('ocultarRetidas', '1');
      return api<Relatorio>(`/admin/relatorios/metodo?${p.toString()}`, { token: token! });
    },
  });

  const chartData = useMemo(
    () =>
      (rel.data?.grafico?.pontos ?? []).map((p) => ({
        label: p.label,
        faturamento: Number(p.faturamento),
        med: Number(p.med),
      })),
    [rel.data?.grafico],
  );

  const aplicar = () =>
    setAplicado({
      dataInicial,
      dataFinal,
      adquirente,
      usuario,
      ocultarRetidas,
    });

  const limpar = () => {
    const hoje = hojeISO();
    setDataInicial(hoje);
    setDataFinal(hoje);
    setAdquirente('');
    setUsuario('');
    setOcultarRetidas(false);
    setAplicado({
      dataInicial: hoje,
      dataFinal: hoje,
      adquirente: '',
      usuario: '',
      ocultarRetidas: false,
    });
  };

  const d = rel.data;
  const oculta = aplicado.ocultarRetidas;

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Relatório Método</h1>
      <p className="mt-1 text-sm opacity-70">
        Dashboard operacional de cash-in PIX: volume, conversão, saúde e breakdown por
        adquirente/usuário.
      </p>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroData
            label="Data inicial"
            value={dataInicial}
            onChange={setDataInicial}
          />
          <FiltroData label="Data final" value={dataFinal} onChange={setDataFinal} />
          <FiltroSelect label="Adquirente" value={adquirente} onChange={setAdquirente}>
            <option value="">Todas</option>
            {adquirentes.data?.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </FiltroSelect>
          <FiltroTexto
            label="Usuário"
            value={usuario}
            onChange={setUsuario}
            placeholder="nome, e-mail ou id"
          />
          <label className="flex min-w-[10rem] flex-1 basis-48 items-center gap-2 pb-2 text-sm sm:max-w-xs">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-800/20"
              checked={ocultarRetidas}
              onChange={(e) => setOcultarRetidas(e.target.checked)}
            />
            Ocultar colunas retidas
          </label>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:pb-0.5">
            <button
              type="button"
              onClick={aplicar}
              className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-white"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={limpar}
              className="h-10 rounded-md border border-ink-800/15 px-4 text-sm dark:border-white/15"
            >
              Limpar
            </button>
          </div>
        </BarraFiltros>

        {dias > 7 && rel.isFetching && !rel.data && (
          <p className="mb-4 text-sm opacity-60">
            Período longo — carregando agregações…
          </p>
        )}

        {d && (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <BannerSaude
                tipo="pagas"
                nivel={d.saude.pagas.nivel}
                mensagem={d.saude.mensagemPagas}
              />
              <BannerSaude
                tipo="aguardando"
                nivel={d.saude.aguardando.nivel}
                mensagem={d.saude.mensagemAguardando}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,22rem)_1fr]">
              <div className="flex flex-col gap-4">
                <FaixaKpis
                  titulo="Geral (todas as adquirentes)"
                  m={d.geral}
                  ocultarRetidas={oculta}
                />
                {d.filtrado && (
                  <FaixaKpis
                    titulo={`Geral (filtrado: ${aplicado.adquirente})`}
                    m={d.filtrado}
                    ocultarRetidas={oculta}
                  />
                )}
              </div>

              {d.grafico && (
                <section className="rounded-xl border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="font-display text-sm font-semibold">
                        Relatório gráfico — faturamento
                      </h2>
                      <p className="text-xs opacity-55">{d.grafico.granularidade}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={72}
                          tickFormatter={(v) =>
                            Number(v).toLocaleString('pt-BR', {
                              notation: 'compact',
                              maximumFractionDigits: 1,
                            })
                          }
                        />
                        <Tooltip
                          formatter={(v, name) => [
                            brl(Number(v)),
                            name === 'faturamento'
                              ? 'Faturamento (pagas + retidas)'
                              : 'MED + MEDs retidos',
                          ]}
                        />
                        <Legend
                          formatter={(v) =>
                            v === 'faturamento'
                              ? 'Faturamento (pagas + retidas)'
                              : 'MED + MEDs retidos'
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="faturamento"
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="med"
                          stroke="#dc2626"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </div>

            <TabelaConversao
              titulo="Conversão por adquirente"
              subtitulo="Métricas por adquirente no período selecionado. Base: cash-in no intervalo de datas."
              modo="adquirente"
              ocultarRetidas={oculta}
              rows={d.porAdquirente.map((r) => ({
                ...r,
                chave: r.codigo,
                rotulo: r.nome || r.codigo,
              }))}
            />

            <TabelaConversao
              titulo="Por usuário (todas as adquirentes)"
              subtitulo="Exibindo os 300 maiores por pagas. Para ver todos, use um período menor ou filtre o usuário."
              modo="usuario"
              ocultarRetidas={oculta}
              rows={d.porUsuario.map((r) => ({
                ...r,
                chave: r.idPublico,
                rotulo: r.nome || r.email,
              }))}
            />

            {d.porUsuarioFiltrado && (
              <TabelaConversao
                titulo={`Por usuário (filtrado: ${aplicado.adquirente})`}
                subtitulo="Mesmo recorte de usuário, restrito à adquirente selecionada."
                modo="usuario"
                ocultarRetidas={oculta}
                rows={d.porUsuarioFiltrado.map((r) => ({
                  ...r,
                  chave: r.idPublico,
                  rotulo: r.nome || r.email,
                }))}
              />
            )}

            {dias <= 15 && (
              <p className="mt-4 text-xs opacity-50">
                Atualização automática a cada 2 minutos (período ≤ 15 dias).
              </p>
            )}
          </>
        )}

        {rel.isLoading && (
          <p className="mt-8 text-sm opacity-60">Carregando relatório…</p>
        )}
        {rel.isError && (
          <p className="mt-8 text-sm text-red-600">
            Não foi possível carregar o relatório. Tente novamente.
          </p>
        )}
      </div>
    </Shell>
  );
}
