'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, Coluna, FiltroSelect, FiltroTexto, SeletorPorPagina, TabelaPaginada } from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const corStatus = (s: string) => {
  if (['CONCLUIDA', 'LIQUIDADA', 'COMPLETED'].includes(s)) return 'text-emerald-600 dark:text-emerald-400';
  if (['FALHA', 'CANCELADA', 'DEVOLVIDA'].includes(s)) return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
};

type ItemVenda = {
  titulo: string;
  quantidade: number;
  valorUnitario: string;
  valorTotal: string;
  tangivel: boolean;
};

type Item = {
  idTransacao: string;
  criadoEm: string;
  empresa: string;
  cliente: string;
  clienteEmail: string | null;
  produto: string;
  itens: ItemVenda[];
  valorBruto: string;
  valorTarifa: string;
  valorLiquido: string;
  situacao: string;
  adquirente: string;
  beneficiario: string | null;
  chavePix: string | null;
  endToEnd: string | null;
};
type Resposta = { pagina: number; limite: number; total: number; itens: Item[] };

/**
 * Coluna "Produto": os itens reais da venda. Mostra até 2 linhas de detalhe e
 * resume o resto — a lista inteira iria estourar a altura da linha da tabela.
 */
function CelulaProduto({ item }: { item: Item }) {
  const itens = item.itens ?? [];
  if (!itens.length) return <span>{item.produto}</span>;
  const visiveis = itens.slice(0, 2);
  const restantes = itens.length - visiveis.length;
  const fisico = itens.some((i) => i.tangivel);

  return (
    <div>
      <p className="font-medium">
        {itens[0].titulo}
        {itens.length > 1 && (
          <span className="opacity-60"> +{itens.length - 1}</span>
        )}
      </p>
      {visiveis.map((i, idx) => (
        <p key={idx} className="text-xs opacity-60">
          {i.quantidade}× {i.titulo} · {brl(i.valorTotal)}
        </p>
      ))}
      {restantes > 0 && (
        <p className="text-xs opacity-60">
          +{restantes} {restantes === 1 ? 'item' : 'itens'}
        </p>
      )}
      {fisico && (
        <p className="text-xs text-amber-600 dark:text-amber-400">produto físico</p>
      )}
    </div>
  );
}

export function RelatorioTransacoes({
  direcao,
  titulo,
  descricao,
}: {
  direcao: 'ENTRADA' | 'SAIDA';
  titulo: string;
  descricao: string;
}) {
  const { token } = useAuth();
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [cliente, setCliente] = useState('');
  const [adquirente, setAdquirente] = useState('');
  const [situacao, setSituacao] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);

  const reset = () => setPagina(1);

  const adquirentes = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!token,
    queryFn: () => api<Array<{ codigo: string; nome: string }>>('/admin/provedores', { token: token! }),
  });

  const rel = useQuery({
    queryKey: ['rel-tx', direcao, dataInicial, dataFinal, cliente, adquirente, situacao, busca, pagina, limite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ direcao, page: String(pagina), limit: String(limite) });
      if (dataInicial) p.set('dataInicial', dataInicial);
      if (dataFinal) p.set('dataFinal', dataFinal);
      if (cliente) p.set('cliente', cliente);
      if (adquirente) p.set('adquirente', adquirente);
      if (situacao) p.set('situacao', situacao);
      if (busca) p.set('busca', busca);
      return api<Resposta>(`/admin/relatorios/transacoes?${p.toString()}`, { token: token! });
    },
  });

  const cashIn = direcao === 'ENTRADA';
  const colunas: Coluna<Item>[] = [
    { chave: 'criadoEm', titulo: 'Data', render: (t) => new Date(t.criadoEm).toLocaleString('pt-BR') },
    { chave: 'idTransacao', titulo: 'Transação', render: (t) => <span className="font-mono text-xs">#{t.idTransacao.slice(0, 8)}</span> },
    { chave: 'empresa', titulo: 'Empresa' },
    ...(cashIn
      ? ([
          { chave: 'cliente', titulo: 'Cliente', render: (t: Item) => (<div><p>{t.cliente}</p>{t.clienteEmail && <p className="text-xs opacity-60">{t.clienteEmail}</p>}</div>) },
          { chave: 'produto', titulo: 'Produto', render: (t: Item) => <CelulaProduto item={t} /> },
        ] as Coluna<Item>[])
      : ([
          { chave: 'beneficiario', titulo: 'Beneficiário', render: (t: Item) => t.beneficiario ?? '—' },
          { chave: 'chavePix', titulo: 'Chave PIX', render: (t: Item) => <span className="font-mono text-xs">{t.chavePix ?? '—'}</span> },
        ] as Coluna<Item>[])),
    { chave: 'valorBruto', titulo: cashIn ? 'Valor' : 'Valor bruto', render: (t) => brl(t.valorBruto) },
    { chave: 'valorTarifa', titulo: cashIn ? 'Taxa' : 'Taxa cash-out', render: (t) => brl(t.valorTarifa) },
    { chave: 'valorLiquido', titulo: 'Líquido', render: (t) => brl(t.valorLiquido) },
    { chave: 'situacao', titulo: 'Status', render: (t) => <span className={`text-xs font-medium ${corStatus(t.situacao)}`}>{t.situacao}</span> },
    { chave: 'adquirente', titulo: 'Adquirente', render: (t) => <span className="font-mono text-xs">{t.adquirente}</span> },
    ...(!cashIn
      ? ([{ chave: 'endToEnd', titulo: 'endToEnd', render: (t: Item) => <span className="font-mono text-xs">{t.endToEnd ?? '—'}</span> }] as Coluna<Item>[])
      : []),
  ];

  const dateCls =
    'mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm font-normal dark:border-white/15 dark:bg-ink-900';

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">{titulo}</h1>
      <p className="mt-1 text-sm opacity-70">{descricao}</p>

      <div className="mt-6">
        <BarraFiltros>
          <label className="flex flex-col text-xs font-medium opacity-70">
            Data inicial
            <input type="date" className={dateCls} value={dataInicial} onChange={(e) => { setDataInicial(e.target.value); reset(); }} />
          </label>
          <label className="flex flex-col text-xs font-medium opacity-70">
            Data final
            <input type="date" className={dateCls} value={dataFinal} onChange={(e) => { setDataFinal(e.target.value); reset(); }} />
          </label>
          <FiltroTexto label="Cliente" value={cliente} onChange={(v) => { setCliente(v); reset(); }} placeholder="empresa ou e-mail" />
          <FiltroSelect label="Adquirente" value={adquirente} onChange={(v) => { setAdquirente(v); reset(); }}>
            <option value="">Todas</option>
            {adquirentes.data?.map((a) => (<option key={a.codigo} value={a.codigo}>{a.nome}</option>))}
          </FiltroSelect>
          <FiltroTexto label="Status" value={situacao} onChange={(v) => { setSituacao(v.toUpperCase()); reset(); }} placeholder="ex.: CONCLUIDA" />
          <FiltroTexto label="Busca" value={busca} onChange={(v) => { setBusca(v); reset(); }} placeholder="Ref ou idTransacao" />
          {(dataInicial || dataFinal || cliente || adquirente || situacao || busca) && (
            <button type="button" className="text-sm text-accent underline" onClick={() => { setDataInicial(''); setDataFinal(''); setCliente(''); setAdquirente(''); setSituacao(''); setBusca(''); reset(); }}>
              Limpar
            </button>
          )}
          <SeletorPorPagina value={limite} onChange={(n) => { setLimite(n); setPagina(1); }} />
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={rel.data?.itens ?? []}
          chave={(t) => t.idTransacao}
          carregando={rel.isLoading}
          vazio="Nenhuma operação no período/filtros."
          tamanhoPagina={limite}
          total={rel.data?.total ?? 0}
          pagina={pagina}
          onPagina={setPagina}
        />
      </div>
    </Shell>
  );
}
