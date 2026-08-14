'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { Ajuda } from '@/components/ajuda';
import {
  BarraFiltros,
  BotaoLimparFiltros,
  Coluna,
  FiltroData,
  FiltroSelect,
  FiltroTexto,
  SeletorPorPagina,
  TabelaPaginada,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDataHora } from '@/lib/fuso';

type Acesso = {
  id: string;
  criadoEm: string;
  metodo: string;
  caminho: string;
  statusHttp: number;
  sucesso: boolean;
  codigoErro: string | null;
  mensagemErro: string | null;
  latenciaMs: number | null;
  enderecoIp: string | null;
  agenteUsuario: string | null;
  identificadorRastreio: string | null;
  chavePublica: string | null;
  credencialNome: string | null;
  cliente: string | null;
  clienteEmail: string | null;
};

type Resposta = { pagina: number; limite: number; total: number; itens: Acesso[] };

type Resumo = {
  total: number;
  falhas: number;
  naoAutorizados: number;
  taxaFalha: number;
  porStatus: Array<{ status: number; quantidade: number }>;
  ipsComMaisFalhas: Array<{ ip: string | null; falhas: number }>;
};

const ROTAS = [
  { valor: '/v1/auth/token', rotulo: 'Emissão de token' },
  { valor: '/v1/pix/cobrancas', rotulo: 'Criar cobrança' },
  { valor: '/v1/pix/saques', rotulo: 'Criar saque' },
  { valor: '/v1/pix/transacoes', rotulo: 'Consultar transação' },
  { valor: '/v1/saldo', rotulo: 'Consultar saldo' },
];

const dataHora = (v: string) =>
  formatarDataHora(v, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * Cor pela FAMÍLIA do status, não pelo número exato: 2xx é rotina, 4xx é
 * recusa (o que interessa vigiar) e 5xx é falha nossa — a distinção que muda
 * o que a pessoa faz a seguir.
 */
function BadgeStatus({ status }: { status: number }) {
  const tom =
    status < 400
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 401 || status === 403
        ? 'bg-red-500/15 text-red-700 dark:text-red-300'
        : status < 500
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300';
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${tom}`}>
      {status}
    </span>
  );
}

function Cartao({
  rotulo,
  valor,
  ajuda,
  alerta,
}: {
  rotulo: string;
  valor: string;
  ajuda: string;
  alerta?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
      <p className="flex items-center gap-1 text-xs uppercase tracking-wide opacity-55">
        {rotulo}
        <Ajuda texto={ajuda} />
      </p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          alerta ? 'text-red-600 dark:text-red-400' : ''
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

export default function SegurancaPage() {
  const { token } = useAuth();
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [rota, setRota] = useState('');
  // Abre em "só falhas": é o motivo de existir da tela. Rotina de 200 é ruído
  // que esconde a rajada de 401 no meio.
  const [resultado, setResultado] = useState('falha');
  const [ip, setIp] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [detalhe, setDetalhe] = useState<Acesso | null>(null);

  const filtros = new URLSearchParams({
    ...(dataInicial ? { dataInicial } : {}),
    ...(dataFinal ? { dataFinal } : {}),
    ...(rota ? { rota } : {}),
    ...(resultado ? { resultado } : {}),
    ...(ip ? { ip } : {}),
    ...(busca ? { busca } : {}),
  });

  const chaveFiltros = filtros.toString();
  const reset = () => setPagina(1);

  const lista = useQuery<Resposta>({
    queryKey: ['seguranca-acessos', chaveFiltros, pagina, limite],
    enabled: !!token,
    refetchInterval: 15_000,
    queryFn: () =>
      api(`/admin/seguranca/acessos?${chaveFiltros}&page=${pagina}&limit=${limite}`, {
        token: token!,
      }),
  });

  const resumo = useQuery<Resumo>({
    queryKey: ['seguranca-resumo', chaveFiltros],
    enabled: !!token,
    refetchInterval: 15_000,
    queryFn: () =>
      api(`/admin/seguranca/resumo?${chaveFiltros}`, { token: token! }),
  });

  const colunas: Coluna<Acesso>[] = [
    {
      chave: 'quando',
      titulo: 'Quando',
      render: (r) => (
        <span className="whitespace-nowrap text-xs">{dataHora(r.criadoEm)}</span>
      ),
    },
    {
      chave: 'rota',
      titulo: 'Rota',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">
            <span className="opacity-60">{r.metodo}</span> {r.caminho}
          </p>
          {r.latenciaMs != null && (
            <p className="text-[11px] opacity-50">{r.latenciaMs} ms</p>
          )}
        </div>
      ),
    },
    {
      chave: 'status',
      titulo: 'Status',
      render: (r) => <BadgeStatus status={r.statusHttp} />,
    },
    {
      chave: 'erro',
      titulo: 'Erro',
      render: (r) =>
        r.sucesso ? (
          <span className="opacity-40">—</span>
        ) : (
          <div className="min-w-0 max-w-[22rem]">
            {r.codigoErro && (
              <p className="font-mono text-[11px] opacity-70">{r.codigoErro}</p>
            )}
            <p className="truncate text-xs" title={r.mensagemErro ?? ''}>
              {r.mensagemErro ?? '—'}
            </p>
          </div>
        ),
    },
    {
      chave: 'ip',
      titulo: 'Origem (IP)',
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {r.enderecoIp ?? '—'}
        </span>
      ),
    },
    {
      chave: 'quem',
      titulo: 'Quem',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-xs">{r.cliente ?? 'não identificado'}</p>
          <p className="truncate font-mono text-[11px] opacity-55">
            {r.credencialNome ?? r.chavePublica ?? '—'}
          </p>
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      render: (r) => (
        <button
          type="button"
          onClick={() => setDetalhe(r)}
          className="whitespace-nowrap rounded-md border border-ink-800/15 px-2 py-1 text-xs transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Detalhes
        </button>
      ),
    },
  ];

  const d = resumo.data;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Segurança
          </h1>
          <p className="mt-1 text-sm opacity-60">
            Toda chamada às rotas sensíveis da API pública — quem chamou, de onde e o
            que falhou.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          rotulo="Chamadas"
          valor={String(d?.total ?? 0)}
          ajuda="Total de chamadas às rotas /v1/* no período filtrado, com sucesso ou não."
        />
        <Cartao
          rotulo="Recusadas"
          valor={String(d?.falhas ?? 0)}
          alerta={(d?.falhas ?? 0) > 0}
          ajuda="Chamadas que terminaram em erro (status 400 ou maior)."
        />
        <Cartao
          rotulo="Não autorizadas"
          valor={String(d?.naoAutorizados ?? 0)}
          alerta={(d?.naoAutorizados ?? 0) > 0}
          ajuda="401 e 403: credencial inválida, token expirado, escopo faltando ou IP fora da allowlist. É o número que denuncia varredura e chave vazada."
        />
        <Cartao
          rotulo="Taxa de recusa"
          valor={`${((d?.taxaFalha ?? 0) * 100).toFixed(1).replace('.', ',')}%`}
          ajuda="Recusadas ÷ total. Integração saudável fica perto de zero; salto repentino costuma ser chave revogada ou cliente com bug."
        />
      </div>

      {!!d?.ipsComMaisFalhas?.length && (
        <div className="mt-3 rounded-xl border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide opacity-55">
            IPs com mais recusas
            <Ajuda texto="Ordenado por FALHAS, não por volume: quem erra em rajada é o sinal de varredura ou força bruta. Cliente movimentado que acerta não aparece aqui." />
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.ipsComMaisFalhas.map((i) => (
              <button
                key={i.ip ?? 'sem-ip'}
                type="button"
                onClick={() => {
                  setIp(i.ip ?? '');
                  reset();
                }}
                className="rounded-full border border-red-500/30 px-3 py-1 font-mono text-xs text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                title="Filtrar por este IP"
              >
                {i.ip ?? '—'} · {i.falhas}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <BarraFiltros>
          <FiltroData
            label="Data inicial"
            value={dataInicial}
            onChange={(v) => {
              setDataInicial(v);
              reset();
            }}
          />
          <FiltroData
            label="Data final"
            value={dataFinal}
            onChange={(v) => {
              setDataFinal(v);
              reset();
            }}
          />
          <FiltroSelect
            label="Rota"
            value={rota}
            onChange={(v) => {
              setRota(v);
              reset();
            }}
          >
            <option value="">Todas</option>
            {ROTAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect
            label="Resultado"
            value={resultado}
            onChange={(v) => {
              setResultado(v);
              reset();
            }}
          >
            <option value="falha">Só recusadas</option>
            <option value="sucesso">Só aceitas</option>
            <option value="">Todas</option>
          </FiltroSelect>
          <FiltroTexto
            label="IP"
            value={ip}
            onChange={(v) => {
              setIp(v);
              reset();
            }}
            placeholder="Ex.: 200.10."
          />
          <FiltroTexto
            label="Busca"
            value={busca}
            onChange={(v) => {
              setBusca(v);
              reset();
            }}
            placeholder="Chave, cliente, erro ou rastreio"
          />
          {(dataInicial || dataFinal || rota || ip || busca || resultado !== 'falha') && (
            <BotaoLimparFiltros
              onClick={() => {
                setDataInicial('');
                setDataFinal('');
                setRota('');
                setResultado('falha');
                setIp('');
                setBusca('');
                reset();
              }}
            />
          )}
          <SeletorPorPagina
            value={limite}
            onChange={(n) => {
              setLimite(n);
              setPagina(1);
            }}
          />
        </BarraFiltros>
      </div>

      <div className="mt-3">
        <TabelaPaginada
          colunas={colunas}
          dados={lista.data?.itens ?? []}
          chave={(r) => r.id}
          carregando={lista.isLoading}
          vazio={
            resultado === 'falha'
              ? 'Nenhuma chamada recusada no período — é o resultado que se espera ver aqui.'
              : 'Nenhuma chamada no período.'
          }
          total={lista.data?.total ?? 0}
          pagina={pagina}
          onPagina={setPagina}
          tamanhoPagina={limite}
        />
      </div>

      {detalhe && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-ink-800/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-ink-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold">
                  Detalhes da chamada
                </h2>
                <p className="mt-0.5 font-mono text-xs opacity-60">
                  {detalhe.metodo} {detalhe.caminho}
                </p>
              </div>
              <BadgeStatus status={detalhe.statusHttp} />
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              {[
                ['Quando', dataHora(detalhe.criadoEm)],
                ['Resultado', detalhe.sucesso ? 'Aceita' : 'Recusada'],
                ['Código do erro', detalhe.codigoErro],
                ['Mensagem', detalhe.mensagemErro],
                ['Origem (IP)', detalhe.enderecoIp],
                ['Cliente', detalhe.cliente],
                ['E-mail do cliente', detalhe.clienteEmail],
                ['Credencial', detalhe.credencialNome],
                ['Chave pública', detalhe.chavePublica],
                ['Latência', detalhe.latenciaMs != null ? `${detalhe.latenciaMs} ms` : null],
                ['Rastreio', detalhe.identificadorRastreio],
                ['Agente', detalhe.agenteUsuario],
              ]
                .filter(([, v]) => v)
                .map(([rotulo, valor]) => (
                  <div
                    key={rotulo as string}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-ink-800/5 pb-2 last:border-0 dark:border-white/5"
                  >
                    <dt className="text-xs uppercase tracking-wide opacity-50">
                      {rotulo}
                    </dt>
                    <dd className="min-w-0 break-all text-right text-sm">{valor}</dd>
                  </div>
                ))}
            </dl>

            <p className="mt-4 rounded-lg bg-ink-800/[0.04] px-3 py-2 text-xs leading-relaxed opacity-70 dark:bg-white/[0.04]">
              O corpo da requisição e o segredo da credencial não são guardados — só
              a chave pública apresentada.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetalhe(null)}
                className="rounded-lg border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
