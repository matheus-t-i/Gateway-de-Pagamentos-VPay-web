'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
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

type Carteira = {
  idPublico: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  tipoPessoa: 'PF' | 'PJ';
  situacao: string;
  dono: { idPublico: string; nome: string; email: string };
  disponivel: string;
  pendenteLiberacao: string;
  reservado: string;
  bloqueadoMed: string;
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
    total: string;
  };
  itens: Carteira[];
};

const SITUACOES = [
  'PENDENTE',
  'EM_ANALISE',
  'ATIVA',
  'REPROVADA',
  'SUSPENSA',
  'BLOQUEADA',
  'ENCERRADA',
];

const ORDENACOES: Array<[string, string]> = [
  ['disponivel', 'Maior disponível'],
  ['pendente', 'Maior a liberar'],
  ['bloqueado', 'Maior bloqueado no MED'],
  ['razaoSocial', 'Razão social (A–Z)'],
  ['recentes', 'Mais recentes'],
];

const brl = (v: string | null) =>
  v == null
    ? '—'
    : 'R$ ' +
      Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const corSituacao = (s: string) => {
  if (s === 'ATIVA')
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (['SUSPENSA', 'EM_ANALISE', 'PENDENTE'].includes(s))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
};

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
  const { token } = useAuth();
  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [comSaldo, setComSaldo] = useState('');
  const [ordenar, setOrdenar] = useState('disponivel');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);

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
      if (comSaldo) p.set('comSaldo', comSaldo);
      return api<Resposta>(`/admin/carteiras?${p.toString()}`, { token: token! });
    },
  });

  const totais = q.data?.totais;

  const colunas: Coluna<Carteira>[] = [
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (c) => (
        <div className="min-w-[12rem]">
          <p className="font-medium">{c.razaoSocial}</p>
          <p className="text-xs opacity-60">
            {c.nomeFantasia ? `${c.nomeFantasia} · ` : ''}
            {formatarDocumento(c.cnpj)}
          </p>
        </div>
      ),
    },
    {
      chave: 'dono',
      titulo: 'Cliente',
      render: (c) => (
        <div className="min-w-[11rem]">
          <Link
            href={`/admin/usuarios/${c.dono.idPublico}`}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {c.dono.nome}
          </Link>
          <p className="text-xs opacity-60">{c.dono.email}</p>
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
      render: (c) => brl(c.disponivel),
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
      titulo: 'Bloqueado MED',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => (
        <span className={Number(c.bloqueadoMed) > 0 ? 'text-red-600' : 'opacity-70'}>
          {brl(c.bloqueadoMed)}
        </span>
      ),
    },
    {
      chave: 'total',
      titulo: 'Total',
      className: 'text-right whitespace-nowrap tabular-nums',
      render: (c) => <span className="font-semibold">{brl(c.total)}</span>,
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">
        Carteiras dos clientes
      </h1>
      <p className="mt-1 text-sm opacity-70">
        Saldo de cada cliente. É dinheiro do lojista — o saldo da
        VPay nas adquirentes está em{' '}
        <Link href="/admin/saldos" className="text-accent underline">
          Saldos Adquirentes
        </Link>
        . A carteira é aberta na ativação da conta, então cadastros ainda em
        análise não aparecem aqui.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Total rotulo="Disponível" valor={totais?.disponivel} />
        <Total rotulo="A liberar" valor={totais?.pendenteLiberacao} />
        <Total rotulo="Reservado" valor={totais?.reservado} />
        <Total rotulo="Bloqueado MED" valor={totais?.bloqueadoMed} />
        <Total rotulo="Total em carteira" valor={totais?.total} destaque />
      </div>

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
    </Shell>
  );
}
