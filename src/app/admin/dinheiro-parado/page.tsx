'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  Coluna,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDataHora } from '@/lib/fuso';

/**
 * DINHEIRO PARADO — a resposta ao "vou ter que analisar caso a caso".
 *
 * Cada aba é um ponto onde o sistema CONGELA em vez de retentar (decisão de
 * desenho: sem chave de idempotência na liquidante, retry às cegas paga em
 * dobro). O que era investigação nos logs vira uma linha com o motivo que o
 * próprio fluxo gravou: mensagem da tentativa, ultimoErro da devolução,
 * ultimoErro da liberação.
 */

const brl = (v: string | number | null) =>
  v == null
    ? '—'
    : 'R$ ' +
      Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const dataHora = (v: string | null) => formatarDataHora(v);

/** Idade em dias/horas — urgência visual sem o admin fazer conta. */
function Idade({ desde }: { desde: string }) {
  const ms = Date.now() - new Date(desde).getTime();
  const horas = Math.floor(ms / 3_600_000);
  const texto = horas >= 48 ? `${Math.floor(horas / 24)} d` : `${horas} h`;
  const cor =
    horas >= 24
      ? 'text-red-600 dark:text-red-400'
      : horas >= 4
        ? 'text-amber-600 dark:text-amber-400'
        : 'opacity-60';
  return <span className={`font-medium tabular-nums ${cor}`}>{texto}</span>;
}

function BadgeSituacao({ valor }: { valor: string }) {
  const cores: Record<string, string> = {
    AMBIGUO: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    AMBIGUA: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    SEM_TENTATIVA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    COM_TENTATIVA: 'bg-ink-800/10 text-ink-800/70 dark:bg-white/10 dark:text-white/60',
    PENDENTE: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    PROCESSANDO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    FALHA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        cores[valor] ?? 'bg-ink-800/10 text-ink-800/70 dark:bg-white/10 dark:text-white/60'
      }`}
    >
      {valor.replaceAll('_', ' ')}
    </span>
  );
}

/** Motivo truncado com o texto completo no title (hover). */
function Motivo({ texto }: { texto: string }) {
  return (
    <span className="block max-w-[28rem] truncate text-xs opacity-80" title={texto}>
      {texto}
    </span>
  );
}

type Saque = {
  idTransacao: string;
  cliente: string;
  clienteIdPublico: string;
  valor: string;
  criadoEm: string;
  tipo: 'AMBIGUO' | 'COM_TENTATIVA' | 'SEM_TENTATIVA';
  motivo: string;
};
type Devolucao = {
  idDevolucao: string;
  idTransacao: string;
  cliente: string;
  clienteIdPublico: string;
  valor: string;
  situacao: string;
  tentativas: number;
  criadoEm: string;
  motivo: string;
};
type Liberacao = {
  id: string;
  idTransacao: string;
  cliente: string;
  clienteIdPublico: string;
  valor: string;
  tipo: string;
  liberarEm: string;
  tentativas: number;
  motivo: string;
};
type Fantasma = {
  idTransacao: string;
  cliente: string;
  clienteIdPublico: string;
  valor: string;
  criadoEm: string;
  motivo: string;
};
type Resposta = {
  saquesSemDesfecho: Saque[];
  devolucoesPresas: Devolucao[];
  liberacoesTravadas: Liberacao[];
  cashinFantasma: Fantasma[];
};

const ABAS = [
  { chave: 'saques', rotulo: 'Saques sem desfecho' },
  { chave: 'devolucoes', rotulo: 'Devoluções' },
  { chave: 'liberacoes', rotulo: 'Liberações' },
  { chave: 'fantasmas', rotulo: 'Cash-in fantasma' },
] as const;
type Aba = (typeof ABAS)[number]['chave'];

export default function DinheiroParadoPage() {
  const { token } = useAuth();
  const [aba, setAba] = useState<Aba>('saques');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dinheiro-parado'],
    queryFn: () => api<Resposta>('/admin/relatorios/dinheiro-parado', { token: token! }),
    enabled: !!token,
    // Tela de plantão: atualiza sozinha, o admin deixa aberta.
    refetchInterval: 60_000,
  });

  const porCliente = <T extends { cliente: string; idTransacao?: string }>(itens: T[]) =>
    busca
      ? itens.filter(
          (i) =>
            i.cliente.toLowerCase().includes(busca.toLowerCase()) ||
            (i.idTransacao ?? '').toLowerCase().includes(busca.toLowerCase()),
        )
      : itens;

  const saques = useMemo(() => {
    const base = porCliente(data?.saquesSemDesfecho ?? []);
    return situacao && aba === 'saques' ? base.filter((s) => s.tipo === situacao) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, busca, situacao, aba]);
  const devolucoes = useMemo(() => {
    const base = porCliente(data?.devolucoesPresas ?? []);
    return situacao && aba === 'devolucoes'
      ? base.filter((d) => d.situacao === situacao)
      : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, busca, situacao, aba]);
  const liberacoes = useMemo(
    () => porCliente(data?.liberacoesTravadas ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, busca],
  );
  const fantasmas = useMemo(
    () => porCliente(data?.cashinFantasma ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, busca],
  );

  const contagens: Record<Aba, number> = {
    saques: data?.saquesSemDesfecho.length ?? 0,
    devolucoes: data?.devolucoesPresas.length ?? 0,
    liberacoes: data?.liberacoesTravadas.length ?? 0,
    fantasmas: data?.cashinFantasma.length ?? 0,
  };
  const total =
    contagens.saques + contagens.devolucoes + contagens.liberacoes + contagens.fantasmas;

  const colSaques: Coluna<Saque>[] = [
    { chave: 'id', titulo: 'Transação', render: (s) => <code className="text-xs">{s.idTransacao}</code> },
    { chave: 'cliente', titulo: 'Cliente', render: (s) => s.cliente },
    { chave: 'valor', titulo: 'Valor', render: (s) => brl(s.valor) },
    { chave: 'tipo', titulo: 'Situação', render: (s) => <BadgeSituacao valor={s.tipo} /> },
    { chave: 'idade', titulo: 'Parado há', render: (s) => <Idade desde={s.criadoEm} /> },
    { chave: 'criado', titulo: 'Criado em', render: (s) => dataHora(s.criadoEm) },
    { chave: 'motivo', titulo: 'Motivo', render: (s) => <Motivo texto={s.motivo} /> },
  ];
  const colDevolucoes: Coluna<Devolucao>[] = [
    { chave: 'id', titulo: 'Transação', render: (d) => <code className="text-xs">{d.idTransacao}</code> },
    { chave: 'cliente', titulo: 'Cliente', render: (d) => d.cliente },
    { chave: 'valor', titulo: 'Valor', render: (d) => brl(d.valor) },
    { chave: 'situacao', titulo: 'Situação', render: (d) => <BadgeSituacao valor={d.situacao} /> },
    {
      chave: 'tentativas',
      titulo: 'Tentativas',
      render: (d) => <span className="tabular-nums">{d.tentativas}/8</span>,
    },
    { chave: 'idade', titulo: 'Parado há', render: (d) => <Idade desde={d.criadoEm} /> },
    { chave: 'motivo', titulo: 'Motivo', render: (d) => <Motivo texto={d.motivo} /> },
  ];
  const colLiberacoes: Coluna<Liberacao>[] = [
    { chave: 'id', titulo: 'Transação', render: (l) => <code className="text-xs">{l.idTransacao}</code> },
    { chave: 'cliente', titulo: 'Cliente', render: (l) => l.cliente },
    { chave: 'valor', titulo: 'Valor', render: (l) => brl(l.valor) },
    { chave: 'tipo', titulo: 'Tipo', render: (l) => l.tipo },
    {
      chave: 'tentativas',
      titulo: 'Tentativas',
      render: (l) => <span className="tabular-nums">{l.tentativas}</span>,
    },
    { chave: 'vencia', titulo: 'Vencia em', render: (l) => dataHora(l.liberarEm) },
    { chave: 'motivo', titulo: 'Motivo', render: (l) => <Motivo texto={l.motivo} /> },
  ];
  const colFantasmas: Coluna<Fantasma>[] = [
    { chave: 'id', titulo: 'Transação', render: (f) => <code className="text-xs">{f.idTransacao}</code> },
    { chave: 'cliente', titulo: 'Cliente', render: (f) => f.cliente },
    { chave: 'valor', titulo: 'Valor', render: (f) => brl(f.valor) },
    { chave: 'idade', titulo: 'Idade', render: (f) => <Idade desde={f.criadoEm} /> },
    { chave: 'criado', titulo: 'Criado em', render: (f) => dataHora(f.criadoEm) },
    { chave: 'motivo', titulo: 'Motivo', render: (f) => <Motivo texto={f.motivo} /> },
  ];

  const opcoesSituacao =
    aba === 'saques'
      ? [
          { valor: 'AMBIGUO', rotulo: 'Ambíguo (em voo)' },
          { valor: 'SEM_TENTATIVA', rotulo: 'Sem tentativa' },
          { valor: 'COM_TENTATIVA', rotulo: 'Com tentativa' },
        ]
      : aba === 'devolucoes'
        ? [
            { valor: 'PENDENTE', rotulo: 'Pendente' },
            { valor: 'PROCESSANDO', rotulo: 'Processando (órfã)' },
            { valor: 'AMBIGUA', rotulo: 'Ambígua' },
            { valor: 'FALHA', rotulo: 'Falha' },
          ]
        : [];

  return (
    <Shell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dinheiro parado</h1>
        <p className="max-w-3xl text-sm opacity-70">
          Valores presos em pontos onde o sistema congela em vez de retentar.
          Cada linha traz o motivo gravado pelo próprio fluxo — antes de
          reprocessar qualquer item, siga o runbook (conferir na liquidante).
          {total === 0 && !isLoading && ' Nada parado agora.'}
        </p>

        {/* Abas com contadores: o número já diz onde olhar primeiro. */}
        <div className="flex flex-wrap gap-2">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              onClick={() => {
                setAba(a.chave);
                setSituacao('');
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                aba === a.chave
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-ink-800/15 hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5'
              }`}
            >
              {a.rotulo}
              <span
                className={`ml-2 inline-block min-w-[1.5rem] rounded-full px-1.5 text-center text-xs font-semibold ${
                  contagens[a.chave] > 0
                    ? aba === a.chave
                      ? 'bg-white/20'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                    : aba === a.chave
                      ? 'bg-white/20'
                      : 'bg-ink-800/10 dark:bg-white/10'
                }`}
              >
                {contagens[a.chave]}
              </span>
            </button>
          ))}
        </div>

        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="Cliente ou idTransacao"
          />
          {opcoesSituacao.length > 0 && (
            <FiltroSelect label="Situação" value={situacao} onChange={setSituacao}>
              <option value="">Todas</option>
              {opcoesSituacao.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </FiltroSelect>
          )}
        </BarraFiltros>

        {aba === 'saques' && (
          <TabelaPaginada
            colunas={colSaques}
            dados={saques}
            chave={(s) => s.idTransacao}
            carregando={isLoading}
            vazio="Nenhum saque parado."
            seletorTamanho
          />
        )}
        {aba === 'devolucoes' && (
          <TabelaPaginada
            colunas={colDevolucoes}
            dados={devolucoes}
            chave={(d) => d.idDevolucao}
            carregando={isLoading}
            vazio="Nenhuma devolução presa."
            seletorTamanho
          />
        )}
        {aba === 'liberacoes' && (
          <TabelaPaginada
            colunas={colLiberacoes}
            dados={liberacoes}
            chave={(l) => l.id}
            carregando={isLoading}
            vazio="Nenhuma liberação travada."
            seletorTamanho
          />
        )}
        {aba === 'fantasmas' && (
          <TabelaPaginada
            colunas={colFantasmas}
            dados={fantasmas}
            chave={(f) => f.idTransacao}
            carregando={isLoading}
            vazio="Nenhum cash-in fantasma suspeito."
            seletorTamanho
          />
        )}
      </div>
    </Shell>
  );
}
