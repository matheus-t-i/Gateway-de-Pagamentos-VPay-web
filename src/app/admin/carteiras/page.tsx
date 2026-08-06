'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { Modal, ModalAcoes } from '@/components/modal';
import {
  BarraFiltros,
  Coluna,
  FiltroSelect,
  FiltroTexto,
  SeletorPorPagina,
  TabelaPaginada,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';
import { PERMISSOES } from '@/lib/permissoes';

type Carteira = {
  idPublico: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  tipoPessoa: 'PF' | 'PJ';
  situacao: string;
  email: string;
  disponivel: string;
  pendenteLiberacao: string;
  reservado: string;
  bloqueadoMed: string;
  bloqueadoManual: string;
  total: string;
  atualizadoEm: string;
};

type Resposta = {
  pagina: number;
  limite: number;
  total: number;
  totais: {
    disponivel: string;
    pendenteLiberacao: string;
    reservado: string;
    bloqueadoMed: string;
    bloqueadoManual: string;
    total: string;
  };
  /** Contas no vermelho — `total` é o tamanho da dívida (positivo). */
  devedores: { quantidade: number; total: string };
  /** Liberações D+/reserva que não completaram (dinheiro parado). */
  liberacoesTravadas: { quantidade: number; total: string };
  itens: Carteira[];
};

type Bloqueio = {
  idPublico: string;
  valorSolicitado: string;
  valorBloqueado: string;
  valorNaoCoberto: string;
  motivo: string | null;
  situacao: string;
  bloqueadoEm: string;
  encerradoEm: string | null;
  cliente: { idPublico: string; nome: string; cpfCnpj: string; email: string };
};

type RespostaBloqueios = {
  pagina: number;
  limite: number;
  total: number;
  itens: Bloqueio[];
};

const SITUACOES = [
  'PENDENTE',
  'EM_ANALISE',
  'ATIVO',
  'REPROVADO',
  'SUSPENSO',
  'BLOQUEADO',
  'ENCERRADO',
];

const ORDENACOES: Array<[string, string]> = [
  ['disponivel', 'Maior disponível'],
  ['devedor', 'Maior dívida'],
  ['pendente', 'Maior a liberar'],
  ['bloqueado', 'Maior bloqueado no MED'],
  ['bloqueadoManual', 'Maior bloqueado adm.'],
  ['razaoSocial', 'Razão social (A–Z)'],
  ['recentes', 'Mais recentes'],
];

const SITUACOES_BLOQUEIO: Array<[string, string]> = [
  ['ATIVO', 'Ativo'],
  ['LIBERADO', 'Liberado'],
  ['DEBITADO', 'Debitado'],
];

const brl = (v: string | null) =>
  v == null
    ? '—'
    : 'R$ ' +
      Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

const corSituacao = (s: string) => {
  if (s === 'ATIVO')
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (['SUSPENSO', 'EM_ANALISE', 'PENDENTE'].includes(s))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
};

const corBloqueio: Record<string, string> = {
  ATIVO: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  LIBERADO:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  DEBITADO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

const inputCls =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900';

/** Cartão de total do filtro inteiro (não só da página). */
function Total({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string | undefined;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 ${
        destaque
          ? 'border-accent/40 bg-accent/5'
          : 'border-ink-800/10 bg-white dark:border-white/10 dark:bg-ink-900'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide opacity-50">{rotulo}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums sm:text-xl">
        {valor === undefined ? '—' : brl(valor)}
      </p>
    </div>
  );
}

export default function CarteirasPage() {
  const { token, pode } = useAuth();
  const podeExecutar = pode(PERMISSOES.ADMIN_CARTEIRAS_EXECUTAR);
  const qc = useQueryClient();

  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [comSaldo, setComSaldo] = useState('');
  const [ordenar, setOrdenar] = useState('disponivel');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);

  const [bBusca, setBBusca] = useState('');
  const [bSituacao, setBSituacao] = useState('ATIVO');
  const [bPagina, setBPagina] = useState(1);
  const [bLimite, setBLimite] = useState(10);

  // Modais
  const [bloquear, setBloquear] = useState<Carteira | null>(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [decidir, setDecidir] = useState<{
    bloqueio: Bloqueio;
    acao: 'liberar' | 'debitar';
  } | null>(null);
  const [motivoDecisao, setMotivoDecisao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const reset = () => setPagina(1);

  const q = useQuery({
    queryKey: ['carteiras', busca, fSituacao, comSaldo, ordenar, pagina, limite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(pagina),
        limit: String(limite),
        ordenar,
      });
      if (busca) p.set('busca', busca);
      if (fSituacao) p.set('situacao', fSituacao);
      // "devedores" é um recorte da própria carteira, então divide o mesmo
      // seletor de "Carteira" em vez de virar um filtro solto.
      if (comSaldo === 'devedores') p.set('devedores', 'true');
      else if (comSaldo) p.set('comSaldo', comSaldo);
      return api<Resposta>(`/admin/carteiras?${p.toString()}`, { token: token! });
    },
  });

  const bloqueios = useQuery({
    queryKey: ['bloqueios-saldo', bBusca, bSituacao, bPagina, bLimite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(bPagina),
        limit: String(bLimite),
      });
      if (bBusca) p.set('busca', bBusca);
      if (bSituacao) p.set('situacao', bSituacao);
      return api<RespostaBloqueios>(`/admin/carteiras/bloqueios?${p.toString()}`, {
        token: token!,
      });
    },
  });

  const aposMutacao = () => {
    setErro(null);
    setBloquear(null);
    setDecidir(null);
    setValor('');
    setMotivo('');
    setMotivoDecisao('');
    void qc.invalidateQueries({ queryKey: ['carteiras'] });
    void qc.invalidateQueries({ queryKey: ['bloqueios-saldo'] });
  };
  const aoFalhar = (e: unknown) =>
    setErro(e instanceof Error ? e.message : 'Operação falhou');

  const criarBloqueio = useMutation({
    mutationFn: (p: { idPublico: string; valor: string; motivo: string }) =>
      api(`/admin/carteiras/${p.idPublico}/bloqueios`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ valor: p.valor, motivo: p.motivo }),
      }),
    onSuccess: aposMutacao,
    onError: aoFalhar,
  });

  const decidirBloqueio = useMutation({
    mutationFn: (p: { idPublico: string; acao: 'liberar' | 'debitar'; motivo: string }) =>
      api(`/admin/carteiras/bloqueios/${p.idPublico}/${p.acao}`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ motivo: p.motivo || undefined }),
      }),
    onSuccess: aposMutacao,
    onError: aoFalhar,
  });

  const totais = q.data?.totais;
  const devedores = q.data?.devedores;
  const travadas = q.data?.liberacoesTravadas;

  const colunas: Coluna<Carteira>[] = [
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (c) => (
        <div className="min-w-[12rem]">
          <Link
            href={`/admin/usuarios/${c.idPublico}`}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {c.razaoSocial}
          </Link>
          <p className="text-xs opacity-60">
            {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
            {formatarDocumento(c.cpfCnpj)}
          </p>
          <p className="text-xs opacity-60">{c.email}</p>
        </div>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (c) => (
        <span
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${corSituacao(
            c.situacao,
          )}`}
        >
          {c.situacao}
        </span>
      ),
    },
    {
      chave: 'disponivel',
      titulo: 'Disponível',
      className: 'text-right whitespace-nowrap tabular-nums',
      // Negativo é dívida do cliente com a VPay — não pode passar por número
      // comum no meio da coluna.
      render: (c) =>
        Number(c.disponivel) < 0 ? (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {brl(c.disponivel)}
          </span>
        ) : (
          brl(c.disponivel)
        ),
    },
    {
      chave: 'pendenteLiberacao',
      titulo: 'A liberar',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => <span className="opacity-70">{brl(c.pendenteLiberacao)}</span>,
    },
    {
      chave: 'reservado',
      titulo: 'Reservado',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => <span className="opacity-70">{brl(c.reservado)}</span>,
    },
    {
      chave: 'bloqueadoMed',
      titulo: 'Bloq. MED',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => (
        <span className={Number(c.bloqueadoMed) > 0 ? 'text-red-600' : 'opacity-70'}>
          {brl(c.bloqueadoMed)}
        </span>
      ),
    },
    {
      chave: 'bloqueadoManual',
      titulo: 'Bloq. adm.',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => (
        <span
          className={Number(c.bloqueadoManual) > 0 ? 'text-red-600' : 'opacity-70'}
        >
          {brl(c.bloqueadoManual)}
        </span>
      ),
    },
    {
      chave: 'total',
      titulo: 'Total',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => <span className="font-semibold">{brl(c.total)}</span>,
    },
    ...(podeExecutar
      ? [
          {
            chave: 'acoes',
            titulo: '',
            render: (c: Carteira) => (
              <button
                type="button"
                onClick={() => {
                  setErro(null);
                  setValor('');
                  setMotivo('');
                  setBloquear(c);
                }}
                className="whitespace-nowrap rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
              >
                Bloquear saldo
              </button>
            ),
          } satisfies Coluna<Carteira>,
        ]
      : []),
  ];

  const colunasBloqueios: Coluna<Bloqueio>[] = [
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (b) => (
        <div className="min-w-[12rem]">
          <Link
            href={`/admin/usuarios/${b.cliente.idPublico}`}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {b.cliente.nome}
          </Link>
          <p className="text-xs opacity-60">{formatarDocumento(b.cliente.cpfCnpj)}</p>
        </div>
      ),
    },
    {
      chave: 'motivo',
      titulo: 'Motivo',
      render: (b) => (
        <p className="max-w-[16rem] whitespace-normal text-xs opacity-80">
          {b.motivo ?? '—'}
        </p>
      ),
    },
    {
      chave: 'valorSolicitado',
      titulo: 'Solicitado',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (b) => brl(b.valorSolicitado),
    },
    {
      chave: 'valorBloqueado',
      titulo: 'Bloqueado',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (b) => (
        <span className={Number(b.valorBloqueado) > 0 ? 'font-medium' : 'opacity-70'}>
          {brl(b.valorBloqueado)}
        </span>
      ),
    },
    {
      chave: 'valorNaoCoberto',
      titulo: 'A capturar',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (b) => (
        <span className={Number(b.valorNaoCoberto) > 0 ? 'text-amber-600' : 'opacity-70'}>
          {brl(b.valorNaoCoberto)}
        </span>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (b) => (
        <span
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
            corBloqueio[b.situacao] ?? ''
          }`}
        >
          {b.situacao}
        </span>
      ),
    },
    {
      chave: 'datas',
      titulo: 'Bloqueado em',
      className: 'whitespace-nowrap text-xs',
      render: (b) => (
        <div>
          <p>{dataHora(b.bloqueadoEm)}</p>
          {b.encerradoEm && (
            <p className="opacity-60">Encerrado {dataHora(b.encerradoEm)}</p>
          )}
        </div>
      ),
    },
    ...(podeExecutar
      ? [
          {
            chave: 'acoes',
            titulo: '',
            render: (b: Bloqueio) =>
              b.situacao === 'ATIVO' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setMotivoDecisao('');
                      setDecidir({ bloqueio: b, acao: 'liberar' });
                    }}
                    className="whitespace-nowrap rounded-md border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    Liberar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setMotivoDecisao('');
                      setDecidir({ bloqueio: b, acao: 'debitar' });
                    }}
                    className="whitespace-nowrap rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                  >
                    Debitar
                  </button>
                </div>
              ) : null,
          } satisfies Coluna<Bloqueio>,
        ]
      : []),
  ];

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">
        Carteiras dos clientes
      </h1>
      <p className="mt-1 text-sm opacity-70">
        Saldo de cada cliente. É dinheiro do lojista — o saldo da VPay nas
        adquirentes está em{' '}
        <Link href="/admin/saldos" className="text-accent underline">
          Saldos Adquirentes
        </Link>
        . A carteira é aberta na ativação da conta, então cadastros ainda em
        análise não aparecem aqui.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Total rotulo="Disponível" valor={totais?.disponivel} />
        <Total rotulo="A liberar" valor={totais?.pendenteLiberacao} />
        <Total rotulo="Reservado" valor={totais?.reservado} />
        <Total rotulo="Bloqueado MED" valor={totais?.bloqueadoMed} />
        <Total rotulo="Bloqueado adm." valor={totais?.bloqueadoManual} />
        <Total rotulo="Total em carteira" valor={totais?.total} destaque />
      </div>

      {/* Alertas de dinheiro que ninguém está vendo. Só aparecem quando existem
          — tela limpa no dia normal. */}
      {(devedores?.quantidade ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => {
            setComSaldo('devedores');
            setOrdenar('devedor');
            reset();
          }}
          className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 text-left transition hover:bg-red-500/10"
        >
          <span className="text-sm">
            <strong className="text-red-600 dark:text-red-400">
              {devedores?.quantidade} conta(s) com saldo negativo
            </strong>{' '}
            <span className="opacity-70">
              — dívida de {brl(devedores?.total ?? '0')} com a VPay (MED debitado
              sem saldo). A conta não saca enquanto não cobrir.
            </span>
          </span>
          <span className="text-xs font-medium text-red-600 underline dark:text-red-400">
            ver devedores
          </span>
        </button>
      )}

      {(travadas?.quantidade ?? 0) > 0 && (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <strong className="text-amber-700 dark:text-amber-400">
            {travadas?.quantidade} liberação(ões) de saldo em falha
          </strong>{' '}
          <span className="opacity-70">
            — {brl(travadas?.total ?? '0')} do lojista parados sem liberar. A fila
            tenta de novo sozinha a cada 10 min; o que continuar aqui precisa de
            análise (veja o log do worker e{' '}
          </span>
          <Link href="/admin/filas" className="text-accent underline">
            Filas
          </Link>
          <span className="opacity-70">).</span>
        </p>
      )}

      {erro && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={(v) => {
              setBusca(v);
              reset();
            }}
            placeholder="nome, documento ou e-mail"
          />
          <FiltroSelect
            label="Situação"
            value={fSituacao}
            onChange={(v) => {
              setFSituacao(v);
              reset();
            }}
          >
            <option value="">Todas</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect
            label="Carteira"
            value={comSaldo}
            onChange={(v) => {
              setComSaldo(v);
              reset();
            }}
          >
            <option value="">Todas</option>
            <option value="true">Somente com saldo</option>
            <option value="devedores">Somente devedores</option>
          </FiltroSelect>
          <FiltroSelect
            label="Ordenar por"
            value={ordenar}
            onChange={(v) => {
              setOrdenar(v);
              reset();
            }}
          >
            {ORDENACOES.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </FiltroSelect>
          <div className="ml-auto self-end">
            <SeletorPorPagina
              value={limite}
              onChange={(n) => {
                setLimite(n);
                reset();
              }}
            />
          </div>
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={q.data?.itens ?? []}
          chave={(c) => c.idPublico}
          carregando={q.isLoading}
          vazio="Nenhuma carteira encontrada."
          tamanhoPagina={limite}
          total={q.data?.total ?? 0}
          pagina={pagina}
          onPagina={setPagina}
        />
      </div>

      {q.isError && (
        <p className="mt-4 text-sm text-red-600">
          Não foi possível carregar as carteiras.
        </p>
      )}

      <h2 className="mt-10 font-display text-xl font-semibold">
        Bloqueios administrativos
      </h2>
      <p className="mt-1 text-sm opacity-70">
        Tratativa de calote/inadimplência: o valor bloqueado sai do disponível na
        hora e o restante é capturado automaticamente conforme o saldo a liberar,
        a reserva e novas vendas viram disponível. O desfecho é seu: liberar de
        volta ao cliente ou debitar da carteira. Bloqueios de MED não aparecem
        aqui — vivem em{' '}
        <Link href="/admin/med" className="text-accent underline">
          MED
        </Link>
        .
      </p>

      <div className="mt-4">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={bBusca}
            onChange={(v) => {
              setBBusca(v);
              setBPagina(1);
            }}
            placeholder="nome, documento ou e-mail"
          />
          <FiltroSelect
            label="Situação"
            value={bSituacao}
            onChange={(v) => {
              setBSituacao(v);
              setBPagina(1);
            }}
          >
            <option value="">Todas</option>
            {SITUACOES_BLOQUEIO.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </FiltroSelect>
          <div className="ml-auto self-end">
            <SeletorPorPagina
              value={bLimite}
              onChange={(n) => {
                setBLimite(n);
                setBPagina(1);
              }}
            />
          </div>
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunasBloqueios}
          dados={bloqueios.data?.itens ?? []}
          chave={(b) => b.idPublico}
          carregando={bloqueios.isLoading}
          vazio="Nenhum bloqueio administrativo."
          tamanhoPagina={bLimite}
          total={bloqueios.data?.total ?? 0}
          pagina={bPagina}
          onPagina={setBPagina}
        />
      </div>

      {/* Modal: criar bloqueio */}
      <Modal
        open={!!bloquear}
        onClose={() => setBloquear(null)}
        title="Bloquear saldo do cliente"
      >
        {bloquear && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              criarBloqueio.mutate({
                idPublico: bloquear.idPublico,
                valor,
                motivo,
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-md border border-ink-800/10 p-3 text-sm dark:border-white/10">
              <p className="font-medium">{bloquear.razaoSocial}</p>
              <p className="text-xs opacity-60">
                {formatarDocumento(bloquear.cpfCnpj)} · {bloquear.email}
              </p>
              <p className="mt-2 text-xs opacity-70">
                Disponível agora: <strong>{brl(bloquear.disponivel)}</strong> · A
                liberar: {brl(bloquear.pendenteLiberacao)} · Reservado:{' '}
                {brl(bloquear.reservado)}
              </p>
            </div>
            <p className="text-xs opacity-70">
              O bloqueio trava o que houver de disponível na hora; o que faltar é
              capturado automaticamente conforme o dinheiro for liberando (D+,
              reserva e novas vendas), até cobrir o valor.
            </p>
            <label className="block text-sm">
              Valor a bloquear (R$)
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputCls}
                placeholder="0,00"
              />
            </label>
            <label className="block text-sm">
              Motivo
              <textarea
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="ex.: chargeback não ressarcido / inadimplência contratual"
              />
            </label>
            <ModalAcoes
              onCancelar={() => setBloquear(null)}
              rotulo="Bloquear"
              pendente={criarBloqueio.isPending}
            />
          </form>
        )}
      </Modal>

      {/* Modal: liberar/debitar bloqueio */}
      <Modal
        open={!!decidir}
        onClose={() => setDecidir(null)}
        title={decidir?.acao === 'debitar' ? 'Debitar bloqueio' : 'Liberar bloqueio'}
      >
        {decidir && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              decidirBloqueio.mutate({
                idPublico: decidir.bloqueio.idPublico,
                acao: decidir.acao,
                motivo: motivoDecisao,
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-md border border-ink-800/10 p-3 text-sm dark:border-white/10">
              <p className="font-medium">{decidir.bloqueio.cliente.nome}</p>
              <p className="mt-1 text-xs opacity-70">
                Bloqueado: <strong>{brl(decidir.bloqueio.valorBloqueado)}</strong>
                {Number(decidir.bloqueio.valorNaoCoberto) > 0 && (
                  <> · ainda a capturar: {brl(decidir.bloqueio.valorNaoCoberto)}</>
                )}
              </p>
            </div>
            <p className="text-sm opacity-80">
              {decidir.acao === 'debitar'
                ? 'O valor bloqueado SAI da carteira do cliente (compensação do prejuízo). A parte ainda não capturada deixa de ser perseguida.'
                : 'O valor bloqueado volta ao disponível do cliente e o bloqueio é encerrado.'}
            </p>
            <label className="block text-sm">
              Motivo{decidir.acao === 'liberar' ? ' (opcional)' : ''}
              <textarea
                required={decidir.acao === 'debitar'}
                value={motivoDecisao}
                onChange={(e) => setMotivoDecisao(e.target.value)}
                className={inputCls}
                rows={3}
              />
            </label>
            <ModalAcoes
              onCancelar={() => setDecidir(null)}
              rotulo={decidir.acao === 'debitar' ? 'Debitar' : 'Liberar'}
              pendente={decidirBloqueio.isPending}
            />
          </form>
        )}
      </Modal>
    </Shell>
  );
}
