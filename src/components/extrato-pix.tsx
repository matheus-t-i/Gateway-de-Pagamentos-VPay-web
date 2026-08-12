'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  BotaoLimparFiltros,
  Coluna,
  FiltroData,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
} from '@/components/tabela';
import { BadgeSituacao, BadgeTipoOperacao, rotuloSituacao } from '@/components/status';
import { BotaoReenviarWebhook } from '@/components/reenviar-webhook';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { podeReenviarCallback } from '@/lib/callback-lojista';

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Situações que a transação REALMENTE assume em cada sentido — mesma regra do
 * relatório do admin. Oferecer o enum inteiro deixaria opção que nunca traz
 * resultado (cobrança não vira CANCELADA; saque não passa por
 * AGUARDANDO_PAGAMENTO nem MED).
 */
const SITUACOES_ENTRADA = ['AGUARDANDO_PAGAMENTO', 'CONCLUIDA', 'FALHA', 'MED'];
const SITUACOES_SAIDA = ['PROCESSANDO', 'CONCLUIDA', 'FALHA', 'CANCELADA'];

type ItemVenda = {
  titulo: string;
  quantidade: number;
  valorUnitario: string;
  valorTotal: string;
  tangivel: boolean;
};

type Item = {
  idTransacao: string;
  direcao: string;
  situacao: string;
  valorBruto: string;
  valorTarifa: string;
  valorLiquido: string;
  criadoEm: string;
  liquidadoEm: string | null;
  referenciaExterna: string | null;
  produto: string;
  itens: ItemVenda[];
  pagador: string | null;
  beneficiario: string | null;
  chavePix: string | null;
  endToEnd: string | null;
};

type Lista = { pagina: number; limite: number; itens: Item[] };
type Resumo = {
  quantidade: number;
  quantidadeConcluidas: number;
  bruto: string;
  tarifa: string;
  liquido: string;
};

/** Itens da venda embaixo do nome do pagador, sem estourar a altura da linha. */
function CelulaProduto({ item }: { item: Item }) {
  const itens = item.itens ?? [];
  if (!itens.length) return <span className="text-xs opacity-60">{item.produto}</span>;
  return (
    <div>
      <p className="text-xs">
        {itens[0].titulo}
        {itens.length > 1 && <span className="opacity-60"> +{itens.length - 1}</span>}
      </p>
      {itens.length === 1 && itens[0].quantidade > 1 && (
        <p className="text-[11px] opacity-50">
          {itens[0].quantidade}× {brl(itens[0].valorUnitario)}
        </p>
      )}
    </div>
  );
}

/**
 * Extrato PIX do lojista. Uma tela por SENTIDO do dinheiro — Transações
 * (PIX in) e Transferências (PIX out) — porque as colunas que importam são
 * diferentes: quem pagou e o que foi vendido de um lado, para quem foi e em
 * qual chave do outro. Misturar os dois numa tabela só obrigava o cliente a
 * ler a linha inteira para saber se aquilo entrou ou saiu da carteira.
 */
export function ExtratoPix({ direcao }: { direcao: 'ENTRADA' | 'SAIDA' }) {
  const { token, pode } = useAuth();
  const podeReenviar = pode(PERMISSOES.TRANSACOES_EXECUTAR);
  const entrada = direcao === 'ENTRADA';

  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [situacao, setSituacao] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  /** Filtros da tela em query string — os MESMOS para a lista e para o resumo. */
  const filtros = () => {
    const p = new URLSearchParams({ direcao });
    if (dataInicial) p.set('dataInicial', dataInicial);
    if (dataFinal) p.set('dataFinal', dataFinal);
    if (situacao) p.set('situacao', situacao);
    if (busca) p.set('busca', busca);
    return p;
  };

  const chaveFiltro = [direcao, dataInicial, dataFinal, situacao, busca];

  const extrato = useQuery({
    queryKey: ['extrato', ...chaveFiltro, pagina],
    enabled: !!token,
    // Mantém a página anterior na tela enquanto a próxima carrega — sem isso a
    // tabela pisca vazia a cada "Próxima".
    placeholderData: (anterior) => anterior,
    queryFn: () => {
      const p = filtros();
      p.set('page', String(pagina));
      p.set('limit', '10');
      return api<Lista>(`/painel/transacoes?${p.toString()}`, { token: token! });
    },
  });

  /**
   * Resumo em query PRÓPRIA, com chave SEM a página: contar e somar percorre
   * todo o conjunto filtrado, então trocar de página não pode disparar isso de
   * novo — o React Query reaproveita o resultado enquanto o filtro não muda.
   */
  const resumo = useQuery({
    queryKey: ['extrato-resumo', ...chaveFiltro],
    enabled: !!token,
    placeholderData: (anterior) => anterior,
    queryFn: () =>
      api<Resumo>(`/painel/transacoes/resumo?${filtros().toString()}`, {
        token: token!,
      }),
  });

  const totais = resumo.data;
  const temFiltro = !!(dataInicial || dataFinal || situacao || busca);

  const colunas: Coluna<Item>[] = [
    {
      chave: 'criadoEm',
      titulo: 'Data',
      render: (t) => (
        <div className="whitespace-nowrap">
          <p>{new Date(t.criadoEm).toLocaleDateString('pt-BR')}</p>
          <p className="text-xs opacity-60">
            {new Date(t.criadoEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      chave: 'idTransacao',
      titulo: 'Transação',
      // endToEnd embaixo do id: é o identificador da conciliação bancária, o
      // que o cliente informa ao suporte ("não caiu o E8092…").
      render: (t) => (
        <div>
          <p className="font-mono text-xs">#{t.idTransacao.slice(0, 8)}</p>
          <p className="font-mono text-xs opacity-60" title={t.endToEnd ?? undefined}>
            {t.endToEnd ?? '—'}
          </p>
        </div>
      ),
    },
    {
      chave: 'direcao',
      titulo: 'Tipo operação',
      render: (t) => <BadgeTipoOperacao direcao={t.direcao} />,
    },
    entrada
      ? {
          chave: 'pagador',
          titulo: 'Pagador / produto',
          render: (t: Item) => (
            <div>
              <p className="font-medium">{t.pagador ?? '—'}</p>
              <CelulaProduto item={t} />
            </div>
          ),
        }
      : {
          chave: 'beneficiario',
          titulo: 'Beneficiário / chave',
          render: (t: Item) => (
            <div>
              <p className="font-medium">{t.beneficiario ?? '—'}</p>
              <p className="font-mono text-xs opacity-60">{t.chavePix ?? '—'}</p>
            </div>
          ),
        },
    {
      chave: 'valorBruto',
      titulo: entrada ? 'Valor bruto' : 'Valor enviado',
      className: 'text-right tabular-nums',
      render: (t) => brl(t.valorBruto),
    },
    {
      chave: 'valorTarifa',
      titulo: 'Taxa',
      className: 'text-right tabular-nums',
      // Sempre com o menos na frente: taxa é dinheiro que o cliente PAGA, nos
      // dois sentidos — na entrada sai do que ele recebe, na saída soma ao
      // débito.
      render: (t) => (
        <span className="text-amber-600 dark:text-amber-400">
          − {brl(t.valorTarifa)}
        </span>
      ),
    },
    {
      chave: 'valorLiquido',
      titulo: entrada ? 'Você recebe' : 'Total debitado',
      className: 'text-right tabular-nums',
      render: (t) => (
        <span
          className={`font-semibold ${
            entrada
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {entrada ? '' : '− '}
          {brl(t.valorLiquido)}
        </span>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (t) => <BadgeSituacao situacao={t.situacao} />,
    },
    ...(podeReenviar
      ? ([
          {
            chave: 'acoes',
            titulo: '',
            render: (t: Item) =>
              podeReenviarCallback(t.situacao, entrada ? 'ENTRADA' : 'SAIDA') ? (
                <BotaoReenviarWebhook idTransacao={t.idTransacao} escopo="painel" />
              ) : null,
          },
        ] as Coluna<Item>[])
      : []),
  ];

  return (
    <Shell>
      <div>
        <h1 className="font-display text-3xl font-semibold">
          {entrada ? 'Transações' : 'Transferências'}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {entrada
            ? 'PIX recebido (cash-in): cobranças pagas pelos seus clientes.'
            : 'PIX enviado (cash-out): saques e pagamentos que saíram da sua carteira.'}
        </p>
        <p className="mt-1 text-xs opacity-55">
          {entrada
            ? 'Valor bruto − taxa = o que entra na sua carteira.'
            : 'Valor enviado + taxa = o que sai da sua carteira.'}
        </p>
      </div>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroData
            label="Data inicial"
            value={dataInicial}
            onChange={(v) => {
              setDataInicial(v);
              setPagina(1);
            }}
          />
          <FiltroData
            label="Data final"
            value={dataFinal}
            onChange={(v) => {
              setDataFinal(v);
              setPagina(1);
            }}
          />
          <FiltroSelect
            label="Situação"
            value={situacao}
            onChange={(v) => {
              setSituacao(v);
              setPagina(1);
            }}
          >
            <option value="">Todas</option>
            {(entrada ? SITUACOES_ENTRADA : SITUACOES_SAIDA).map((s) => (
              <option key={s} value={s}>
                {rotuloSituacao(s)}
              </option>
            ))}
          </FiltroSelect>
          <FiltroTexto
            label="Busca"
            value={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="ID, endToEnd ou referência"
          />
          {temFiltro && (
            <BotaoLimparFiltros
              onClick={() => {
                setDataInicial('');
                setDataFinal('');
                setSituacao('');
                setBusca('');
                setPagina(1);
              }}
            />
          )}
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={extrato.data?.itens ?? []}
          chave={(t) => t.idTransacao}
          carregando={extrato.isLoading}
          vazio={
            entrada
              ? 'Nenhuma cobrança para os filtros.'
              : 'Nenhuma transferência para os filtros.'
          }
          tamanhoPagina={10}
          // O total vem do resumo: é ele que conta o conjunto filtrado.
          total={totais?.quantidade ?? 0}
          pagina={pagina}
          onPagina={setPagina}
        />
      </div>
    </Shell>
  );
}
