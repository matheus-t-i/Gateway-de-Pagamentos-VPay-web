'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Shell } from '@/components/shell';
import { Modal } from '@/components/modal';
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
import { PERMISSOES } from '@/lib/permissoes';
import { formatarDataHora } from '@/lib/fuso';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type Conta = {
  id: string;
  nome: string;
  situacao: string;
  pixEntradaHabilitado: boolean;
  adquirente: string;
  codigoAdquirente: string;
  adquirenteAtiva: boolean;
};

type Configuracao = {
  timeoutSegundos: number;
  cadeia: Array<{ ordem: number; ativo: boolean; observacao: string | null; conta: Conta }>;
  contasDisponiveis: Conta[];
};

type Resumo = {
  horas: number;
  desde: string;
  totalFalhas: number;
  vendasSalvas: number;
  vendasPerdidas: number;
  porTipo: Array<{ tipo: string; total: number }>;
  porAdquirente: Array<{ contaProvedorId: string; nome: string; total: number }>;
};

type Falha = {
  idPublico: string;
  tipo: string;
  ordemTentativa: number;
  mensagem: string | null;
  statusHttp: number | null;
  codigoErro: string | null;
  latenciaMs: number | null;
  criadoEm: string;
  adquirente: string;
  contaProvedorId: string;
  resolvidaPor: string | null;
  resolvidaEm: string | null;
  cliente: { idPublico: string; nome: string } | null;
  transacao: {
    idTransacao: string;
    referenciaExterna: string | null;
    situacao: string;
  } | null;
};

type Detalhe = Falha & {
  codigoAdquirente: string;
  transacao: (Falha['transacao'] & { valor: string }) | null;
  dadosRequisicao: unknown;
  dadosResposta: unknown;
};

const TIPOS: Array<[string, string]> = [
  ['TIMEOUT', 'Timeout'],
  ['ERRO_PROVEDOR', 'Erro do provedor'],
  ['SEM_CODIGO_PIX', 'Sem código PIX'],
];

const rotuloTipo = (t: string) => TIPOS.find(([v]) => v === t)?.[1] ?? t;

const corTipo = (t: string) => {
  if (t === 'TIMEOUT')
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  if (t === 'SEM_CODIGO_PIX')
    return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
};

const dataHora = (v: string | null) => formatarDataHora(v);

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

function Cartao({
  rotulo,
  valor,
  cor,
  nota,
}: {
  rotulo: string;
  valor: string | number;
  cor?: string;
  nota?: string;
}) {
  return (
    <div className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900 sm:p-4">
      <p className="text-[11px] uppercase tracking-wide opacity-50">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${cor ?? ''}`}>
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs opacity-50">{nota}</p>}
    </div>
  );
}

/** Editor da ordem em que as adquirentes são tentadas. */
function EditorCadeia({
  config,
  token,
  podeEditar,
  onSalvo,
}: {
  config: Configuracao;
  token: string;
  podeEditar: boolean;
  onSalvo: () => void;
}) {
  const [ordem, setOrdem] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOrdem(config.cadeia.map((c) => c.conta.id));
  }, [config.cadeia]);

  const porId = new Map(config.contasDisponiveis.map((c) => [c.id, c]));
  const disponiveis = config.contasDisponiveis.filter((c) => !ordem.includes(c.id));

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= ordem.length) return;
    const copia = [...ordem];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setOrdem(copia);
    setOk(false);
  };

  const salvar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api('/admin/contingencia', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          contas: ordem.map((id) => ({ contaProvedorId: id })),
          codigoTotp,
        }),
      }),
    onSuccess: () => {
      setErro(null);
      setOk(true);
      onSalvo();
    },
    onError: (e) => {
      setOk(false);
      setErro(erroMsg(e));
    },
  });

  return (
    <section className="rounded-xl border border-ink-800/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Cadeia de contingência</h2>
          <p className="mt-0.5 text-xs opacity-60">
            Ordem de tentativa quando a adquirente do lojista falha. Teto de espera por
            adquirente: <strong>{config.timeoutSegundos}s</strong> (
            <code className="rounded bg-ink-800/10 px-1 dark:bg-white/10">
              CONTINGENCIA_TIMEOUT_SEGUNDOS
            </code>
            ).
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {ordem.map((id, i) => {
          const c = porId.get(id);
          return (
            <li
              key={id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c?.adquirente ?? id}</p>
                <p className="text-xs opacity-60">
                  {c?.nome}
                  {c && !c.adquirenteAtiva ? ' · adquirente inativa' : ''}
                </p>
              </div>
              {podeEditar && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Subir"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    className="rounded border border-ink-800/15 p-1.5 disabled:opacity-30 dark:border-white/15"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label="Descer"
                    onClick={() => mover(i, 1)}
                    disabled={i === ordem.length - 1}
                    className="rounded border border-ink-800/15 p-1.5 disabled:opacity-30 dark:border-white/15"
                  >
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remover"
                    onClick={() => {
                      setOrdem(ordem.filter((x) => x !== id));
                      setOk(false);
                    }}
                    className="rounded border border-ink-800/15 p-1.5 text-red-600 dark:border-white/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {ordem.length === 0 && (
          <li className="rounded-md border border-dashed border-ink-800/20 px-3 py-6 text-center text-sm opacity-60 dark:border-white/20">
            Nenhuma contingência configurada — uma falha na adquirente do lojista perde a
            venda.
          </li>
        )}
      </ol>

      {podeEditar && (
        <>
          {disponiveis.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium opacity-70">Adicionar adquirente</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {disponiveis.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setOrdem([...ordem, c.id]);
                      setOk(false);
                    }}
                    className="rounded-full border border-ink-800/15 px-3 py-1 text-xs transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
                  >
                    + {c.adquirente} · {c.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          {ok && !salvar.isPending && (
            <p className="mt-3 text-sm text-emerald-600">Cadeia salva.</p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setOrdem(config.cadeia.map((c) => c.conta.id));
                setErro(null);
                setOk(false);
              }}
              className="rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                const codigoTotp = await pedirCodigoTotp();
                if (!codigoTotp) return;
                salvar.mutate(codigoTotp);
              }}
              disabled={salvar.isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar cadeia'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** Detalhe da falha, com o response cru para levar à liquidante. */
function ModalFalha({
  idPublico,
  token,
  onClose,
}: {
  idPublico: string | null;
  token: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ['contingencia-falha', idPublico],
    enabled: !!idPublico,
    queryFn: () =>
      api<Detalhe>(`/admin/contingencia/falhas/${idPublico}`, { token }),
  });

  const json = (v: unknown) =>
    v == null ? '—' : JSON.stringify(v, null, 2);

  return (
    <Modal open={!!idPublico} onClose={onClose} title="Falha da adquirente">
      {q.isLoading && <p className="text-sm opacity-60">Carregando…</p>}
      {q.data && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">Adquirente</p>
              <p className="mt-0.5">{q.data.adquirente}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">Tipo</p>
              <p className="mt-0.5">
                <span className={`rounded-full px-2 py-0.5 text-xs ${corTipo(q.data.tipo)}`}>
                  {rotuloTipo(q.data.tipo)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">Tentativa</p>
              <p className="mt-0.5">
                {q.data.ordemTentativa === 0
                  ? 'Adquirente do lojista'
                  : `Contingência #${q.data.ordemTentativa}`}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">Quando</p>
              <p className="mt-0.5">{dataHora(q.data.criadoEm)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">HTTP / código</p>
              <p className="mt-0.5">
                {q.data.statusHttp ?? '—'} · {q.data.codigoErro ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-50">Latência</p>
              <p className="mt-0.5">
                {q.data.latenciaMs != null ? `${q.data.latenciaMs} ms` : '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-wide opacity-50">
                Onde a cobrança foi gerada
              </p>
              <p className="mt-0.5">
                {q.data.resolvidaPor ? (
                  <span className="text-emerald-600">
                    {q.data.resolvidaPor} · {dataHora(q.data.resolvidaEm)}
                  </span>
                ) : (
                  <span className="text-red-600">
                    Nenhuma — a venda não foi recuperada
                  </span>
                )}
              </p>
            </div>
            {q.data.cliente && (
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Lojista</p>
                <p className="mt-0.5">{q.data.cliente.nome}</p>
              </div>
            )}
            {q.data.transacao && (
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Transação</p>
                <p className="mt-0.5 break-all font-mono text-xs">
                  {q.data.transacao.idTransacao}
                </p>
                <p className="text-xs opacity-60">
                  {q.data.transacao.situacao} · R$ {q.data.transacao.valor}
                  {q.data.transacao.referenciaExterna
                    ? ` · ref. ${q.data.transacao.referenciaExterna}`
                    : ''}
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide opacity-50">Mensagem</p>
            <p className="mt-0.5 break-words">{q.data.mensagem ?? '—'}</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide opacity-50">
              Requisição enviada
            </p>
            <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-ink-800/5 p-3 text-xs dark:bg-white/5">
              {json(q.data.dadosRequisicao)}
            </pre>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide opacity-50">
              Response da liquidante
            </p>
            <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-ink-800/5 p-3 text-xs dark:bg-white/5">
              {json(q.data.dadosResposta)}
            </pre>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(json(q.data.dadosResposta))
              }
              className="mt-2 rounded-md border border-ink-800/15 px-3 py-1.5 text-xs font-medium dark:border-white/15"
            >
              Copiar response
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ContingenciaPage() {
  const { token, pode } = useAuth();
  const qc = useQueryClient();
  const [horas, setHoras] = useState('24');
  const [tipo, setTipo] = useState('');
  const [resultado, setResultado] = useState('');
  const [conta, setConta] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [aberta, setAberta] = useState<string | null>(null);

  const reset = () => setPagina(1);
  const podeEditar = pode(PERMISSOES.ADMIN_CONTINGENCIA_EDITAR);

  const config = useQuery({
    queryKey: ['contingencia-config'],
    enabled: !!token,
    queryFn: () => api<Configuracao>('/admin/contingencia', { token: token! }),
  });

  const resumo = useQuery({
    queryKey: ['contingencia-resumo', horas],
    enabled: !!token,
    queryFn: () =>
      api<Resumo>(`/admin/contingencia/resumo?horas=${horas}`, { token: token! }),
    refetchInterval: 60_000,
  });

  const falhas = useQuery({
    queryKey: ['contingencia-falhas', tipo, resultado, conta, busca, pagina, limite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(pagina), limit: String(limite) });
      if (tipo) p.set('tipo', tipo);
      if (resultado) p.set('resultado', resultado);
      if (conta) p.set('contaProvedorId', conta);
      if (busca) p.set('busca', busca);
      return api<{ pagina: number; limite: number; total: number; itens: Falha[] }>(
        `/admin/contingencia/falhas?${p.toString()}`,
        { token: token! },
      );
    },
    refetchInterval: 60_000,
  });

  const colunas: Coluna<Falha>[] = [
    {
      chave: 'criadoEm',
      titulo: 'Quando',
      className: 'whitespace-nowrap',
      render: (f) => <span className="text-xs">{dataHora(f.criadoEm)}</span>,
    },
    {
      chave: 'adquirente',
      titulo: 'Falhou em',
      render: (f) => (
        <div className="min-w-[10rem]">
          <p className="font-medium">{f.adquirente}</p>
          <p className="text-xs opacity-60">
            {f.ordemTentativa === 0
              ? 'adquirente do lojista'
              : `contingência #${f.ordemTentativa}`}
          </p>
        </div>
      ),
    },
    {
      chave: 'tipo',
      titulo: 'Erro',
      render: (f) => (
        <div className="min-w-[12rem]">
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${corTipo(
              f.tipo,
            )}`}
          >
            {rotuloTipo(f.tipo)}
          </span>
          <p className="mt-1 line-clamp-2 text-xs opacity-60">{f.mensagem ?? '—'}</p>
        </div>
      ),
    },
    {
      chave: 'cliente',
      titulo: 'Lojista',
      render: (f) => (
        <span className="text-xs">{f.cliente?.nome ?? '—'}</span>
      ),
    },
    {
      chave: 'resolvidaPor',
      titulo: 'Gerada em',
      render: (f) =>
        f.resolvidaPor ? (
          <span className="text-xs text-emerald-600">{f.resolvidaPor}</span>
        ) : (
          <span className="whitespace-nowrap text-xs font-medium text-red-600">
            venda perdida
          </span>
        ),
    },
    {
      chave: 'acoes',
      titulo: '',
      render: (f) => (
        <button
          type="button"
          onClick={() => setAberta(f.idPublico)}
          className="whitespace-nowrap rounded-md border border-ink-800/15 px-3 py-1 text-xs font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Ver response
        </button>
      ),
    },
  ];

  const r = resumo.data;

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">
        Contingência de adquirentes
      </h1>
      <p className="mt-1 text-sm opacity-70">
        Quando a adquirente do lojista falha ao gerar a cobrança, a venda é repetida na
        cadeia abaixo. Aqui você vê o que falhou, o erro, onde a cobrança acabou sendo
        gerada e o response cru para conferir com a liquidante.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          rotulo="Falhas na janela"
          valor={r?.totalFalhas ?? '—'}
          nota={r ? `desde ${dataHora(r.desde)}` : undefined}
        />
        <Cartao
          rotulo="Vendas salvas"
          valor={r?.vendasSalvas ?? '—'}
          cor="text-emerald-600"
          nota="recuperadas pela contingência"
        />
        <Cartao
          rotulo="Vendas perdidas"
          valor={r?.vendasPerdidas ?? '—'}
          cor={r && r.vendasPerdidas > 0 ? 'text-red-600' : undefined}
          nota="nenhuma adquirente gerou"
        />
        <Cartao
          rotulo="Adquirente com mais falhas"
          valor={r?.porAdquirente[0]?.total ?? '—'}
          nota={r?.porAdquirente[0]?.nome ?? 'sem falhas na janela'}
        />
      </div>

      {r && r.porTipo.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.porTipo.map((t) => (
            <span
              key={t.tipo}
              className={`rounded-full px-3 py-1 text-xs font-medium ${corTipo(t.tipo)}`}
            >
              {rotuloTipo(t.tipo)}: {t.total}
            </span>
          ))}
        </div>
      )}

      {config.data && token && (
        <div className="mt-6">
          <EditorCadeia
            config={config.data}
            token={token}
            podeEditar={podeEditar}
            onSalvo={() => void qc.invalidateQueries({ queryKey: ['contingencia-config'] })}
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">Monitoramento de falhas</h2>

        <div className="mt-3">
          <BarraFiltros>
            <FiltroTexto
              label="Buscar"
              value={busca}
              onChange={(v) => {
                setBusca(v);
                reset();
              }}
              placeholder="erro, código, lojista ou referência"
            />
            <FiltroSelect
              label="Tipo de erro"
              value={tipo}
              onChange={(v) => {
                setTipo(v);
                reset();
              }}
            >
              <option value="">Todos</option>
              {TIPOS.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
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
              <option value="">Todos</option>
              <option value="SALVA">Venda salva</option>
              <option value="PERDIDA">Venda perdida</option>
            </FiltroSelect>
            <FiltroSelect
              label="Adquirente"
              value={conta}
              onChange={(v) => {
                setConta(v);
                reset();
              }}
            >
              <option value="">Todas</option>
              {(config.data?.contasDisponiveis ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.adquirente} · {c.nome}
                </option>
              ))}
            </FiltroSelect>
            <FiltroSelect label="Janela do resumo" value={horas} onChange={setHoras}>
              <option value="1">Última hora</option>
              <option value="24">24 horas</option>
              <option value="168">7 dias</option>
              <option value="720">30 dias</option>
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
            dados={falhas.data?.itens ?? []}
            chave={(f) => f.idPublico}
            carregando={falhas.isLoading}
            vazio="Nenhuma falha registrada — todas as cobranças saíram na primeira tentativa."
            tamanhoPagina={limite}
            total={falhas.data?.total ?? 0}
            pagina={pagina}
            onPagina={setPagina}
          />
        </div>
      </div>

      <p className="mt-4 text-xs opacity-50">
        Cadastro das adquirentes em{' '}
        <Link href="/admin/adquirentes" className="underline">
          Cadastro Adquirentes
        </Link>
        .
      </p>

      {token && (
        <ModalFalha idPublico={aberta} token={token} onClose={() => setAberta(null)} />
      )}
    </Shell>
  );
}
