'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { Modal, ModalAcoes } from '@/components/modal';
import { BarraFiltros, BotaoLimparFiltros, Coluna, FiltroData, FiltroSelect, FiltroTexto, SeletorPorPagina, TabelaPaginada } from '@/components/tabela';
import { BadgeSituacao, rotuloSituacao } from '@/components/status';
import { BotaoReenviarWebhook } from '@/components/reenviar-webhook';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SITUACOES_CASH_IN = ['AGUARDANDO_PAGAMENTO', 'CONCLUIDA', 'FALHA', 'MED'];
const SITUACOES_CASH_OUT = ['PROCESSANDO', 'CONCLUIDA', 'FALHA', 'CANCELADA'];

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
  dataPagamento: string | null;
  empresa: string;
  empresaEmail: string | null;
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
  referenciaExterna: string | null;
  codigoPagamento: string | null;
  retidaMetodo?: boolean;
  medAutomatico?: boolean;
};
type Resposta = { pagina: number; limite: number; total: number; itens: Item[] };

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

function CelulaCodigoPagamento({ codigo }: { codigo: string | null }) {
  const [copiado, setCopiado] = useState(false);
  if (!codigo) return <span className="opacity-40">—</span>;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado */
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={codigo}
      className="max-w-[12rem] truncate rounded px-1.5 py-1 text-left font-mono text-xs transition hover:bg-ink-800/5 dark:hover:bg-white/5"
    >
      {copiado ? (
        <span className="text-emerald-600 dark:text-emerald-400">copiado!</span>
      ) : (
        codigo
      )}
    </button>
  );
}

function BotaoLiberarRetencao({
  item,
  onLiberado,
}: {
  item: Item;
  onLiberado: () => void;
}) {
  const { token } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  const liberar = useMutation({
    mutationFn: () =>
      api(`/admin/relatorios/transacoes/${item.idTransacao}/liberar-retencao`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ codigoTotp: codigo }),
      }),
    onSuccess: () => {
      setAberto(false);
      setCodigo('');
      setErro('');
      onLiberado();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const podeLiberar =
    item.retidaMetodo && item.situacao === 'AGUARDANDO_PAGAMENTO';

  if (!podeLiberar) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-md border border-amber-500/40 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-300"
      >
        Liberar
      </button>
      {aberto && (
        <Modal open={aberto} title="Liberar retenção" onClose={() => setAberto(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              liberar.mutate();
            }}
          >
            <p className="text-sm opacity-70">
              Confirma a liberação da venda #{item.idTransacao.slice(0, 8)}? O
              saldo será creditado e o callback de pagamento enviado ao lojista.
              Digite o código 2FA da sua conta.
            </p>
            <label className="mt-4 block text-xs font-medium opacity-70">
              Código 2FA
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) =>
                  setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 font-mono text-sm tracking-widest outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40"
                placeholder="000000"
              />
            </label>
            {erro && (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {erro}
              </p>
            )}
            <div className="mt-4">
              <ModalAcoes
                onCancelar={() => setAberto(false)}
                rotulo="Liberar venda"
                pendente={liberar.isPending}
                desabilitado={codigo.length !== 6}
              />
            </div>
          </form>
        </Modal>
      )}
    </>
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
  const { token, pode } = useAuth();
  const qc = useQueryClient();
  const podeReenviar = pode(PERMISSOES.ADMIN_FILAS_EXECUTAR);
  const podeLiberar = pode(PERMISSOES.ADMIN_RELATORIOS_EDITAR);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [cliente, setCliente] = useState('');
  const [adquirente, setAdquirente] = useState('');
  const [situacao, setSituacao] = useState('');
  const [metodo, setMetodo] = useState('');
  const [medAuto, setMedAuto] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);

  const reset = () => setPagina(1);
  const cashIn = direcao === 'ENTRADA';

  const adquirentes = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!token,
    queryFn: () => api<Array<{ codigo: string; nome: string }>>('/admin/provedores', { token: token! }),
  });

  const rel = useQuery({
    queryKey: [
      'rel-tx',
      direcao,
      dataInicial,
      dataFinal,
      cliente,
      adquirente,
      situacao,
      metodo,
      medAuto,
      busca,
      pagina,
      limite,
    ],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ direcao, page: String(pagina), limit: String(limite) });
      if (dataInicial) p.set('dataInicial', dataInicial);
      if (dataFinal) p.set('dataFinal', dataFinal);
      if (cliente) p.set('cliente', cliente);
      if (adquirente) p.set('adquirente', adquirente);
      if (situacao) p.set('situacao', situacao);
      if (cashIn && metodo) p.set('metodo', metodo);
      if (cashIn && medAuto) p.set('medAutomatico', medAuto);
      if (busca) p.set('busca', busca);
      return api<Resposta>(`/admin/relatorios/transacoes?${p.toString()}`, { token: token! });
    },
  });

  const colunas: Coluna<Item>[] = [
    ...(podeReenviar || (cashIn && podeLiberar)
      ? ([
          {
            chave: 'acoes',
            titulo: 'Ação',
            render: (t: Item) => (
              <div className="flex flex-col gap-1">
                {podeReenviar && (
                  <BotaoReenviarWebhook idTransacao={t.idTransacao} escopo="admin" />
                )}
                {cashIn && podeLiberar && (
                  <BotaoLiberarRetencao
                    item={t}
                    onLiberado={() =>
                      void qc.invalidateQueries({ queryKey: ['rel-tx'] })
                    }
                  />
                )}
              </div>
            ),
          },
        ] as Coluna<Item>[])
      : []),
    { chave: 'criadoEm', titulo: 'Data', render: (t) => new Date(t.criadoEm).toLocaleString('pt-BR') },
    {
      chave: 'dataPagamento',
      titulo: 'Data pagamento',
      render: (t) =>
        t.dataPagamento ? (
          new Date(t.dataPagamento).toLocaleString('pt-BR')
        ) : (
          <span className="opacity-40">—</span>
        ),
    },
    {
      chave: 'empresa',
      titulo: 'Empresa',
      render: (t) => (
        <div>
          <p>{t.empresa}</p>
          {t.empresaEmail && <p className="text-xs opacity-60">{t.empresaEmail}</p>}
        </div>
      ),
    },
    { chave: 'valorBruto', titulo: cashIn ? 'Valor' : 'Valor bruto', render: (t) => brl(t.valorBruto) },
    { chave: 'valorTarifa', titulo: cashIn ? 'Taxa' : 'Taxa cash-out', render: (t) => brl(t.valorTarifa) },
    { chave: 'valorLiquido', titulo: 'Líquido', render: (t) => brl(t.valorLiquido) },
    {
      chave: 'idTransacao',
      titulo: 'Transação',
      render: (t) => (
        <div>
          <p className="font-mono text-xs">#{t.idTransacao.slice(0, 8)}</p>
          <p className="font-mono text-xs opacity-60" title={t.endToEnd ?? undefined}>
            {t.endToEnd ?? '—'}
          </p>
        </div>
      ),
    },
    { chave: 'situacao', titulo: 'Status', render: (t) => <BadgeSituacao situacao={t.situacao} /> },
    ...(cashIn
      ? ([
          { chave: 'cliente', titulo: 'Cliente', render: (t: Item) => (<div><p>{t.cliente}</p>{t.clienteEmail && <p className="text-xs opacity-60">{t.clienteEmail}</p>}</div>) },
          { chave: 'produto', titulo: 'Produto', render: (t: Item) => <CelulaProduto item={t} /> },
        ] as Coluna<Item>[])
      : ([
          { chave: 'beneficiario', titulo: 'Beneficiário', render: (t: Item) => t.beneficiario ?? '—' },
          { chave: 'chavePix', titulo: 'Chave PIX', render: (t: Item) => <span className="font-mono text-xs">{t.chavePix ?? '—'}</span> },
        ] as Coluna<Item>[])),
    { chave: 'adquirente', titulo: 'Adquirente', render: (t) => <span className="font-mono text-xs">{t.adquirente}</span> },
    {
      chave: 'referenciaExterna',
      titulo: 'Referência externa',
      render: (t) =>
        t.referenciaExterna ? (
          <span className="font-mono text-xs">{t.referenciaExterna}</span>
        ) : (
          <span className="opacity-40">—</span>
        ),
    },
    ...(cashIn
      ? ([
          {
            chave: 'codigoPagamento',
            titulo: 'Código de pagamento',
            render: (t: Item) => <CelulaCodigoPagamento codigo={t.codigoPagamento} />,
          },
          {
            chave: 'retidaMetodo',
            titulo: 'Método',
            render: (t: Item) => (t.retidaMetodo ? 'Sim' : 'Não'),
          },
          {
            chave: 'medAutomatico',
            titulo: 'MED auto',
            render: (t: Item) => (t.medAutomatico ? 'Sim' : 'Não'),
          },
        ] as Coluna<Item>[])
      : []),
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">{titulo}</h1>
      <p className="mt-1 text-sm opacity-70">{descricao}</p>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroData label="Data inicial" value={dataInicial} onChange={(v) => { setDataInicial(v); reset(); }} />
          <FiltroData label="Data final" value={dataFinal} onChange={(v) => { setDataFinal(v); reset(); }} />
          <FiltroTexto label="Cliente" value={cliente} onChange={(v) => { setCliente(v); reset(); }} placeholder="empresa, nome ou e-mail" />
          <FiltroSelect label="Adquirente" value={adquirente} onChange={(v) => { setAdquirente(v); reset(); }}>
            <option value="">Todas</option>
            {adquirentes.data?.map((a) => (<option key={a.codigo} value={a.codigo}>{a.nome}</option>))}
          </FiltroSelect>
          <FiltroSelect label="Status" value={situacao} onChange={(v) => { setSituacao(v); reset(); }}>
            <option value="">Todos</option>
            {(cashIn ? SITUACOES_CASH_IN : SITUACOES_CASH_OUT).map((s) => (
              <option key={s} value={s}>
                {rotuloSituacao(s)}
              </option>
            ))}
          </FiltroSelect>
          {cashIn && (
            <FiltroSelect label="Método" value={metodo} onChange={(v) => { setMetodo(v); reset(); }}>
              <option value="">Todos</option>
              <option value="sim">Retidas</option>
              <option value="nao">Sem método</option>
            </FiltroSelect>
          )}
          {cashIn && (
            <FiltroSelect label="MED auto" value={medAuto} onChange={(v) => { setMedAuto(v); reset(); }}>
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </FiltroSelect>
          )}
          <FiltroTexto label="Busca" value={busca} onChange={(v) => { setBusca(v); reset(); }} placeholder="Ref, idTransacao ou endToEnd" />
          {(dataInicial || dataFinal || cliente || adquirente || situacao || metodo || medAuto || busca) && (
            <BotaoLimparFiltros onClick={() => { setDataInicial(''); setDataFinal(''); setCliente(''); setAdquirente(''); setSituacao(''); setMetodo(''); setMedAuto(''); setBusca(''); reset(); }} />
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
