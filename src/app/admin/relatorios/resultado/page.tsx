'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroData, FiltroSelect, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const pct = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Detalhe = {
  tipo: string;
  adquirente: string;
  operacoes: number;
  volume: string;
  receita: string;
  custo: string;
  resultado: string;
  margem: string;
  taxaCliente: string;
  status: string;
};
type Cliente = {
  idPublico: string;
  nome: string;
  email: string;
  operacoes: number;
  volume: string;
  receita: string;
  custo: string;
  resultado: string;
  margem: string;
  status: string;
  adquirentes: number;
  retido: string;
  retidoOps: number;
  custoAusente: boolean;
  detalhes: Detalhe[];
};
type Relatorio = {
  kpis: {
    volumeProcessado: string;
    receitaCobrada: string;
    custoAdquirentes: string;
    resultadoLiquido: string;
    vendasRetidas: string;
    vendasRetidasOps: number;
    margemSobreVolume: string;
    operacoes: number;
    clientesLucrativos: number;
    clientesPrejuizo: number;
    clientesNeutros: number;
    clientesCustoAusente: number;
  };
  clientes: Cliente[];
  total: number;
};

const corStatus = (s: string) =>
  s === 'Lucro'
    ? 'text-emerald-600 dark:text-emerald-400'
    : s === 'Prejuízo'
      ? 'text-red-600 dark:text-red-400'
      : 'opacity-70';

function Kpi({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
      <p className="text-xs uppercase tracking-wide opacity-60">{titulo}</p>
      <p className="mt-1.5 font-display text-xl">{valor}</p>
      {nota && <p className="mt-0.5 text-xs opacity-50">{nota}</p>}
    </div>
  );
}

export default function RelatorioResultadoPage() {
  const { token } = useAuth();
  const [dataInicial, setDataInicial] = useState(hojeISO());
  const [dataFinal, setDataFinal] = useState(hojeISO());
  const [cliente, setCliente] = useState('');
  const [adquirente, setAdquirente] = useState('');
  const [tipo, setTipo] = useState('');
  const [resultado, setResultado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState(10);

  const adquirentes = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!token,
    queryFn: () =>
      api<Array<{ codigo: string; nome: string }>>('/admin/provedores', { token: token! }),
  });

  const rel = useQuery({
    queryKey: ['rel-resultado', dataInicial, dataFinal, cliente, adquirente, tipo, resultado],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ dataInicial, dataFinal });
      if (cliente) p.set('cliente', cliente);
      if (adquirente) p.set('adquirente', adquirente);
      if (tipo) p.set('tipo', tipo);
      if (resultado) p.set('resultado', resultado);
      return api<Relatorio>(`/admin/relatorios/resultado?${p.toString()}`, { token: token! });
    },
  });

  const k = rel.data?.kpis;
  const clientes = rel.data?.clientes ?? [];
  const totalPaginas = Math.max(1, Math.ceil(clientes.length / tamanho));
  const pag = Math.min(pagina, totalPaginas);
  const visiveis = clientes.slice((pag - 1) * tamanho, pag * tamanho);

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Apuração de Resultado</h1>
      <p className="mt-1 text-sm opacity-70">
        Receita cobrada em vendas pagas confrontada com o custo persistido da
        adquirente. PIX ainda não pago não entra.
      </p>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroData label="Data inicial" value={dataInicial} onChange={(v) => { setDataInicial(v); setPagina(1); }} />
          <FiltroData label="Data final" value={dataFinal} onChange={(v) => { setDataFinal(v); setPagina(1); }} />
          <FiltroTexto label="Cliente" value={cliente} onChange={(v) => { setCliente(v); setPagina(1); }} placeholder="nome, e-mail ou id" />
          <FiltroSelect label="Adquirente" value={adquirente} onChange={(v) => { setAdquirente(v); setPagina(1); }}>
            <option value="">Todas</option>
            {adquirentes.data?.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect label="Tipo" value={tipo} onChange={(v) => { setTipo(v); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="cash-in">Cash-in</option>
            <option value="cash-out">Cash-out</option>
          </FiltroSelect>
          <FiltroSelect label="Resultado" value={resultado} onChange={(v) => { setResultado(v); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="lucro">Lucro</option>
            <option value="prejuizo">Prejuízo</option>
            <option value="neutro">Neutro</option>
          </FiltroSelect>
        </BarraFiltros>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            titulo="Volume processado"
            valor={brl(k?.volumeProcessado ?? 0)}
            nota="vendas pagas"
          />
          <Kpi
            titulo="Receita cobrada"
            valor={brl(k?.receitaCobrada ?? 0)}
            nota="tarifa de vendas pagas"
          />
          <Kpi titulo="Custo das adquirentes" valor={brl(k?.custoAdquirentes ?? 0)} />
          <Kpi
            titulo="Resultado líquido"
            valor={brl(k?.resultadoLiquido ?? 0)}
            nota="receita de vendas pagas − custo"
          />
          <Kpi
            titulo="Vendas retidas"
            valor={brl(k?.vendasRetidas ?? 0)}
            nota={
              k
                ? `${k.vendasRetidasOps} op. pagas na liquidante, sem crédito`
                : undefined
            }
          />
          <Kpi titulo="Margem sobre o volume" valor={pct(k?.margemSobreVolume ?? 0)} />
          <Kpi titulo="Operações" valor={String(k?.operacoes ?? 0)} />
          <Kpi
            titulo="Clientes lucro / prejuízo"
            valor={`${k?.clientesLucrativos ?? 0} / ${k?.clientesPrejuizo ?? 0}`}
            nota={k ? `Neutros: ${k.clientesNeutros} · Custo ausente: ${k.clientesCustoAusente}` : undefined}
          />
        </div>

        {/* Tabela consolidada por cliente */}
        <div className="mt-6 rounded-lg border border-ink-800/10 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-xs uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Ops</th>
                  <th className="px-4 py-2.5 font-medium">Volume</th>
                  <th className="px-4 py-2.5 font-medium">Receita</th>
                  <th className="px-4 py-2.5 font-medium">Custo</th>
                  <th className="px-4 py-2.5 font-medium">Resultado</th>
                  <th className="px-4 py-2.5 font-medium">Margem</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Adq.</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <Fragment key={c.idPublico}>
                    <tr className="border-b border-ink-800/5 dark:border-white/5">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs opacity-60">{c.email}</p>
                      </td>
                      <td className="px-4 py-3">{c.operacoes}</td>
                      <td className="px-4 py-3">{brl(c.volume)}</td>
                      <td className="px-4 py-3">{brl(c.receita)}</td>
                      <td className="px-4 py-3">{brl(c.custo)}</td>
                      <td className={`px-4 py-3 font-medium ${corStatus(c.status)}`}>
                        {brl(c.resultado)}
                        {Number(c.retido) > 0 && (
                          <span className="block text-xs font-normal opacity-60">
                            Retidas (sem crédito): {brl(c.retido)} ({c.retidoOps}{' '}
                            op.)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{pct(c.margem)}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${corStatus(c.status)}`}>{c.status}</td>
                      <td className="px-4 py-3">
                        {c.adquirentes}
                        {c.custoAusente && (
                          <span title="Custo de adquirente ausente em alguma operação" className="ml-1 text-amber-500">
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-xs text-accent underline"
                          onClick={() => setExpandido(expandido === c.idPublico ? null : c.idPublico)}
                        >
                          {expandido === c.idPublico ? 'Ocultar' : 'Detalhes'}
                        </button>
                      </td>
                    </tr>
                    {expandido === c.idPublico && (
                      <tr className="bg-ink-800/[0.02] dark:bg-white/[0.02]">
                        <td colSpan={10} className="px-4 py-3">
                          <table className="min-w-full text-left text-xs">
                            <thead className="opacity-60">
                              <tr>
                                <th className="py-1 pr-4 font-medium">Tipo</th>
                                <th className="py-1 pr-4 font-medium">Adquirente</th>
                                <th className="py-1 pr-4 font-medium">Ops</th>
                                <th className="py-1 pr-4 font-medium">Volume</th>
                                <th className="py-1 pr-4 font-medium">Taxa cliente</th>
                                <th className="py-1 pr-4 font-medium">Receita</th>
                                <th className="py-1 pr-4 font-medium">Custo</th>
                                <th className="py-1 pr-4 font-medium">Resultado</th>
                                <th className="py-1 pr-4 font-medium">Margem</th>
                                <th className="py-1 pr-4 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.detalhes.map((d, i) => (
                                <tr key={i}>
                                  <td className="py-1 pr-4">{d.tipo}</td>
                                  <td className="py-1 pr-4 font-mono">{d.adquirente}</td>
                                  <td className="py-1 pr-4">{d.operacoes}</td>
                                  <td className="py-1 pr-4">{brl(d.volume)}</td>
                                  <td className="py-1 pr-4">{pct(d.taxaCliente)}</td>
                                  <td className="py-1 pr-4">{brl(d.receita)}</td>
                                  <td className="py-1 pr-4">{brl(d.custo)}</td>
                                  <td className={`py-1 pr-4 ${corStatus(d.status)}`}>{brl(d.resultado)}</td>
                                  <td className="py-1 pr-4">{pct(d.margem)}</td>
                                  <td className={`py-1 pr-4 ${corStatus(d.status)}`}>{d.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-sm opacity-60">
                      {rel.isLoading ? 'Carregando…' : 'Nenhuma operação no período/filtros.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacao
            pagina={pag}
            totalPaginas={totalPaginas}
            total={clientes.length}
            onPagina={setPagina}
            seletor={
              <SeletorPorPagina
                value={tamanho}
                onChange={(novo) => {
                  setTamanho(novo);
                  setPagina(1);
                }}
              />
            }
          />
        </div>

        <p className="mt-4 text-xs opacity-50">
          Receita = tarifa persistida só em venda paga (cash-in concluída, liquidada
          ou MED; cash-out concluído). Volume processado usa as mesmas operações.
          PIX aguardando pagamento não entra. Vendas retidas = pagas na liquidante
          sem crédito ao lojista — ficam no card próprio, fora da receita e do
          resultado. Custo ausente é sinalizado (pode superestimar o lucro).
        </p>
      </div>
    </Shell>
  );
}
