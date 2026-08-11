'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  Coluna,
  FiltroData,
  FiltroSelect,
  FiltroTexto,
  SeletorPorPagina,
  TabelaPaginada,
} from '@/components/tabela';
import { Gatilho, GatilhoModal } from '@/components/gatilho-modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

const brl = (v: string | number | null) =>
  v == null
    ? '—'
    : 'R$ ' +
      Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const dataHora = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR') : '—';

type Saldo = {
  contaProvedorId: string;
  conta: string;
  adquirente: string;
  adquirenteCodigo: string;
  situacaoConta: string;
  situacaoAdquirente: string;
  pixSaidaHabilitado: boolean;
  moeda: string;
  saldoDisponivel: string | null;
  saldoBloqueado: string | null;
  consultadoEm: string | null;
  erroUltimaConsulta: string | null;
  totalGatilhos: number;
};

type Execucao = {
  id: string;
  criadoEm: string;
  gatilho: string;
  gatilhoId: string;
  adquirente: string;
  adquirenteCodigo: string;
  conta: string;
  origem: string;
  saldoObservado: string;
  valorSolicitado: string;
  situacao: string;
  idTransacaoLiquidante: string | null;
  mensagemErro: string | null;
  concluidoEm: string | null;
  chavePix: string;
  tipoChavePix: string;
};

type Resumo = {
  saquesLojistas: Array<{
    situacao: string;
    quantidade: number;
    valorBruto: string;
    valorTarifa: string;
  }>;
  tesouraria: Array<{ situacao: string; quantidade: number; valor: string }>;
};

type Pagina<T> = { pagina: number; limite: number; total: number; itens: T[] };

const corSituacao = (s: string) => {
  if (['CONCLUIDA', 'ENVIADA'].includes(s)) return 'text-emerald-600 dark:text-emerald-400';
  if (['FALHA', 'CANCELADA'].includes(s)) return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
};

const badge = (ativo: boolean) =>
  ativo
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
    : 'bg-ink-800/10 text-ink-800/70 dark:bg-white/10 dark:text-white/60';

function erroMsg(e: unknown) {
  let m = e instanceof Error ? e.message : 'Falha';
  try {
    const j = JSON.parse(m) as { message?: unknown };
    if (typeof j.message === 'string') m = j.message;
  } catch {
    /* texto puro */
  }
  return m;
}

export default function SaldosPage() {
  const { token, pode } = useAuth();
  const podeEditarGatilho = pode(PERMISSOES.ADMIN_TESOURARIA_EDITAR);
  const podeExecutar = pode(PERMISSOES.ADMIN_TESOURARIA_EXECUTAR);
  const qc = useQueryClient();

  const [modal, setModal] = useState<{ aberto: boolean; gatilho: Gatilho | null }>({
    aberto: false,
    gatilho: null,
  });
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Filtros/paginação — gatilhos
  const [gAdquirente, setGAdquirente] = useState('');
  const [gAtivo, setGAtivo] = useState('');
  const [gBusca, setGBusca] = useState('');
  const [gPagina, setGPagina] = useState(1);
  const [gLimite, setGLimite] = useState(10);

  // Filtros/paginação — execuções
  const [eSituacao, setESituacao] = useState('');
  const [eOrigem, setEOrigem] = useState('');
  const [eAdquirente, setEAdquirente] = useState('');
  const [eDataInicial, setEDataInicial] = useState('');
  const [eDataFinal, setEDataFinal] = useState('');
  const [ePagina, setEPagina] = useState(1);
  const [eLimite, setELimite] = useState(10);

  const adquirentes = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!token,
    queryFn: () =>
      api<Array<{ codigo: string; nome: string }>>('/admin/provedores', { token: token! }),
  });

  const saldos = useQuery({
    queryKey: ['tesouraria-saldos'],
    enabled: !!token,
    queryFn: () => api<Saldo[]>('/admin/tesouraria/saldos', { token: token! }),
  });

  const resumo = useQuery({
    queryKey: ['tesouraria-resumo'],
    enabled: !!token,
    queryFn: () => api<Resumo>('/admin/tesouraria/saques/resumo', { token: token! }),
  });

  const gatilhos = useQuery({
    queryKey: ['tesouraria-gatilhos', gAdquirente, gAtivo, gBusca, gPagina, gLimite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(gPagina), limit: String(gLimite) });
      if (gAdquirente) p.set('adquirente', gAdquirente);
      if (gAtivo) p.set('ativo', gAtivo);
      if (gBusca) p.set('busca', gBusca);
      return api<Pagina<Gatilho>>(`/admin/tesouraria/gatilhos?${p}`, { token: token! });
    },
  });

  const execucoes = useQuery({
    queryKey: [
      'tesouraria-execucoes',
      eSituacao,
      eOrigem,
      eAdquirente,
      eDataInicial,
      eDataFinal,
      ePagina,
      eLimite,
    ],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(ePagina), limit: String(eLimite) });
      if (eSituacao) p.set('situacao', eSituacao);
      if (eOrigem) p.set('origem', eOrigem);
      if (eAdquirente) p.set('adquirente', eAdquirente);
      if (eDataInicial) p.set('dataInicial', eDataInicial);
      if (eDataFinal) p.set('dataFinal', eDataFinal);
      return api<Pagina<Execucao>>(`/admin/tesouraria/execucoes?${p}`, { token: token! });
    },
  });

  const atualizar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api('/admin/tesouraria/saldos/atualizar', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigoTotp }),
      }),
    onSuccess: () => {
      setAviso({ tipo: 'ok', texto: 'Saldos atualizados na adquirente.' });
      void qc.invalidateQueries({ queryKey: ['tesouraria-saldos'] });
      void qc.invalidateQueries({ queryKey: ['tesouraria-gatilhos'] });
    },
    onError: (e) => setAviso({ tipo: 'erro', texto: erroMsg(e) }),
  });

  const executar = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api<{ valorSolicitado: string }>(`/admin/tesouraria/gatilhos/${p.id}/executar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: (r) => {
      setAviso({ tipo: 'ok', texto: `Saque de ${brl(r.valorSolicitado)} enviado à fila.` });
      void qc.invalidateQueries({ queryKey: ['tesouraria-execucoes'] });
      void qc.invalidateQueries({ queryKey: ['tesouraria-gatilhos'] });
      void qc.invalidateQueries({ queryKey: ['tesouraria-resumo'] });
    },
    onError: (e) => setAviso({ tipo: 'erro', texto: erroMsg(e) }),
  });

  const colunasGatilho: Coluna<Gatilho>[] = [
    { chave: 'nome', titulo: 'Gatilho', render: (g) => (
      <div>
        <p className="font-medium">{g.nome}</p>
        <p className="text-xs opacity-60">{g.adquirente} · {g.conta}</p>
      </div>
    ) },
    { chave: 'valorGatilho', titulo: 'Dispara com', render: (g) => brl(g.valorGatilho) },
    { chave: 'valorReserva', titulo: 'Reserva', render: (g) => brl(g.valorReserva) },
    {
      chave: 'limites',
      titulo: 'Mín / Máx',
      render: (g) => `${brl(g.valorMinimoPayout)} / ${g.valorMaximoPayout ? brl(g.valorMaximoPayout) : 'sem teto'}`,
    },
    {
      chave: 'chavePix',
      titulo: 'Destino',
      render: (g) => (
        <div>
          <p className="font-mono text-xs">{g.chavePix}</p>
          <p className="text-xs opacity-60">{g.tipoChavePix}</p>
        </div>
      ),
    },
    { chave: 'saldoDisponivel', titulo: 'Saldo hoje', render: (g) => brl(g.saldoDisponivel) },
    {
      chave: 'ultimaExecucaoEm',
      titulo: 'Último saque',
      render: (g) => <span className="text-xs">{dataHora(g.ultimaExecucaoEm)}</span>,
    },
    {
      chave: 'ativo',
      titulo: 'Situação',
      render: (g) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(g.ativo)}`}>
          {g.ativo ? 'ATIVO' : 'INATIVO'}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      render: (g) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs text-accent underline"
            onClick={() => setModal({ aberto: true, gatilho: g })}
          >
            {podeEditarGatilho ? 'Editar' : 'Detalhes'}
          </button>
          {podeExecutar && (
            <button
              type="button"
              disabled={!g.ativo || executar.isPending}
              className="text-xs text-accent underline disabled:opacity-40 disabled:no-underline"
              onClick={async () => {
                const codigoTotp = await pedirCodigoTotp();
                if (!codigoTotp) return;
                executar.mutate({ id: g.id, codigoTotp });
              }}
            >
              Executar agora
            </button>
          )}
        </div>
      ),
    },
  ];

  const colunasExecucao: Coluna<Execucao>[] = [
    {
      chave: 'criadoEm',
      titulo: 'Quando',
      render: (e) => <span className="text-xs">{dataHora(e.criadoEm)}</span>,
    },
    {
      chave: 'gatilho',
      titulo: 'Gatilho',
      render: (e) => (
        <div>
          <p>{e.gatilho}</p>
          <p className="text-xs opacity-60">{e.adquirente} · {e.conta}</p>
        </div>
      ),
    },
    { chave: 'origem', titulo: 'Origem', render: (e) => <span className="text-xs">{e.origem}</span> },
    { chave: 'saldoObservado', titulo: 'Saldo observado', render: (e) => brl(e.saldoObservado) },
    { chave: 'valorSolicitado', titulo: 'Valor sacado', render: (e) => brl(e.valorSolicitado) },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (e) => (
        <div>
          <span className={`font-medium ${corSituacao(e.situacao)}`}>{e.situacao}</span>
          {e.mensagemErro && (
            <p className="max-w-[16rem] truncate text-xs opacity-60" title={e.mensagemErro}>
              {e.mensagemErro}
            </p>
          )}
        </div>
      ),
    },
    {
      chave: 'idTransacaoLiquidante',
      titulo: 'Ref. adquirente',
      render: (e) => <span className="font-mono text-xs">{e.idTransacaoLiquidante ?? '—'}</span>,
    },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Saldos Adquirentes</h1>
          <p className="mt-1 text-sm opacity-70">
            Saldo da VPay em cada adquirente, gatilhos de saque automático e o
            acompanhamento dos saques. Para o saldo dos lojistas, veja{' '}
            <Link href="/admin/carteiras" className="text-accent underline">
              Carteiras dos clientes
            </Link>
            .
          </p>
        </div>
        {podeExecutar && (
          <button
            type="button"
            onClick={async () => {
              const codigoTotp = await pedirCodigoTotp();
              if (!codigoTotp) return;
              atualizar.mutate(codigoTotp);
            }}
            disabled={atualizar.isPending}
            className="rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
          >
            {atualizar.isPending ? 'Atualizando…' : 'Atualizar saldos'}
          </button>
        )}
      </div>

      {aviso && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            aviso.tipo === 'ok'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Saldo por adquirente */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Saldo por adquirente</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saldos.data?.map((s) => (
            <div
              key={s.contaProvedorId}
              className="rounded-lg border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.adquirente}</p>
                  <p className="text-xs opacity-60">{s.conta}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(
                    s.situacaoConta === 'ATIVO' && s.situacaoAdquirente === 'ATIVO',
                  )}`}
                >
                  {s.situacaoConta}
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-semibold">
                {brl(s.saldoDisponivel)}
              </p>
              <p className="text-xs opacity-60">
                Bloqueado: {brl(s.saldoBloqueado)} · {s.totalGatilhos} gatilho
                {s.totalGatilhos === 1 ? '' : 's'}
              </p>
              <p className="mt-2 text-xs opacity-50">
                Consultado em {dataHora(s.consultadoEm)}
              </p>
              {!s.pixSaidaHabilitado && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Conta sem PIX de saída — não saca.
                </p>
              )}
              {s.erroUltimaConsulta && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Última consulta falhou: {s.erroUltimaConsulta}
                </p>
              )}
            </div>
          ))}
          {!saldos.data?.length && (
            <p className="text-sm opacity-60">
              {saldos.isLoading ? 'Carregando…' : 'Nenhuma conta de adquirente cadastrada.'}
            </p>
          )}
        </div>
      </section>

      {/* Acompanhamento de saques */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Acompanhamento de saques</h2>
          <Link href="/admin/relatorios/cash-out" className="text-xs text-accent underline">
            Ver relatório detalhado de cash-out
          </Link>
        </div>
        <p className="mt-1 text-xs opacity-60">Saques dos lojistas, por situação.</p>
        <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-5">
          {resumo.data?.saquesLojistas.map((r) => (
            <div
              key={r.situacao}
              className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900"
            >
              <p className={`text-xs font-medium ${corSituacao(r.situacao)}`}>{r.situacao}</p>
              <p className="mt-1 font-display text-xl font-semibold">{r.quantidade}</p>
              <p className="text-xs opacity-60">{brl(r.valorBruto)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs opacity-60">Saques de tesouraria (gatilhos), por situação.</p>
        <div className="mt-2 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {resumo.data?.tesouraria.map((r) => (
            <div
              key={r.situacao}
              className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900"
            >
              <p className={`text-xs font-medium ${corSituacao(r.situacao)}`}>{r.situacao}</p>
              <p className="mt-1 font-display text-xl font-semibold">{r.quantidade}</p>
              <p className="text-xs opacity-60">{brl(r.valor)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gatilhos */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Gatilhos de saque automático</h2>
          {podeEditarGatilho && (
            <button
              type="button"
              onClick={() => setModal({ aberto: true, gatilho: null })}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Novo gatilho
            </button>
          )}
        </div>

        <div className="mt-3">
          <BarraFiltros>
            <FiltroSelect
              label="Adquirente"
              value={gAdquirente}
              onChange={(v) => {
                setGAdquirente(v);
                setGPagina(1);
              }}
            >
              <option value="">Todas</option>
              {adquirentes.data?.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </FiltroSelect>
            <FiltroSelect
              label="Situação"
              value={gAtivo}
              onChange={(v) => {
                setGAtivo(v);
                setGPagina(1);
              }}
            >
              <option value="">Todas</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </FiltroSelect>
            <FiltroTexto
              label="Busca"
              value={gBusca}
              onChange={(v) => {
                setGBusca(v);
                setGPagina(1);
              }}
              placeholder="nome, chave ou titular"
            />
            <div className="ml-auto self-end">
              <SeletorPorPagina
                value={gLimite}
                onChange={(n) => {
                  setGLimite(n);
                  setGPagina(1);
                }}
              />
            </div>
          </BarraFiltros>

          <TabelaPaginada
            colunas={colunasGatilho}
            dados={gatilhos.data?.itens ?? []}
            chave={(g) => g.id}
            carregando={gatilhos.isLoading}
            vazio="Nenhum gatilho cadastrado."
            tamanhoPagina={gLimite}
            total={gatilhos.data?.total ?? 0}
            pagina={gPagina}
            onPagina={setGPagina}
          />
        </div>
      </section>

      {/* Execuções */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Execuções dos gatilhos</h2>

        <div className="mt-3">
          <BarraFiltros>
            <FiltroSelect
              label="Situação"
              value={eSituacao}
              onChange={(v) => {
                setESituacao(v);
                setEPagina(1);
              }}
            >
              <option value="">Todas</option>
              {['PENDENTE', 'ENVIADA', 'CONCLUIDA', 'FALHA'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FiltroSelect>
            <FiltroSelect
              label="Origem"
              value={eOrigem}
              onChange={(v) => {
                setEOrigem(v);
                setEPagina(1);
              }}
            >
              <option value="">Todas</option>
              <option value="AUTOMATICO">Automático</option>
              <option value="MANUAL">Manual</option>
            </FiltroSelect>
            <FiltroSelect
              label="Adquirente"
              value={eAdquirente}
              onChange={(v) => {
                setEAdquirente(v);
                setEPagina(1);
              }}
            >
              <option value="">Todas</option>
              {adquirentes.data?.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </FiltroSelect>
            <FiltroData
              label="Data inicial"
              value={eDataInicial}
              onChange={(v) => {
                setEDataInicial(v);
                setEPagina(1);
              }}
            />
            <FiltroData
              label="Data final"
              value={eDataFinal}
              onChange={(v) => {
                setEDataFinal(v);
                setEPagina(1);
              }}
            />
            <div className="ml-auto self-end">
              <SeletorPorPagina
                value={eLimite}
                onChange={(n) => {
                  setELimite(n);
                  setEPagina(1);
                }}
              />
            </div>
          </BarraFiltros>

          <TabelaPaginada
            colunas={colunasExecucao}
            dados={execucoes.data?.itens ?? []}
            chave={(e) => e.id}
            carregando={execucoes.isLoading}
            vazio="Nenhuma execução ainda."
            tamanhoPagina={eLimite}
            total={execucoes.data?.total ?? 0}
            pagina={ePagina}
            onPagina={setEPagina}
          />
        </div>
      </section>

      <GatilhoModal
        open={modal.aberto}
        gatilho={modal.gatilho}
        token={token ?? ''}
        onClose={() => setModal({ aberto: false, gatilho: null })}
      />
    </Shell>
  );
}
