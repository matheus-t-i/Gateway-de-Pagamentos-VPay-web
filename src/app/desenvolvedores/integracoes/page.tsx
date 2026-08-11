'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Shell } from '@/components/shell';
import { LogoApp } from '@/components/logo-app';
import { Modal, ModalAcoes } from '@/components/modal';
import { TextoRotulo } from '@/components/obrigatorio';
import { BadgeSituacao } from '@/components/status';
import {
  BarraFiltros,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
  type Coluna,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { confirmarAcao } from '@/lib/dialogos';
import {
  type AppIntegracao,
  eventosPadraoDoApp,
  ROTULO_EVENTO_INTEGRACAO,
  type EventoIntegracao,
} from '@/lib/integracoes';

const INPUT =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900';

type Integracao = {
  id: string;
  tipo: string;
  nome: string;
  eventos: string[];
  /** Se EXISTE credencial guardada — o valor nunca volta pela API. */
  temCredencial: boolean;
  modoTeste: boolean;
  ativo: boolean;
  criadoEm: string;
  ultimoEnvio: { situacao: string; status: string; em: string } | null;
};

type Envio = {
  id: string;
  idTransacao: string;
  referenciaExterna: string | null;
  status: string;
  situacao: string;
  numeroTentativa: number;
  statusHttp: number | null;
  mensagemErro: string | null;
  latenciaMs: number | null;
  em: string;
};

function dataHora(valor: string) {
  return new Date(valor).toLocaleString('pt-BR');
}

/** Mensagem legível do erro da API (JSON do Nest/Zod ou texto puro). */
function erroMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Falha na operação';
}

export default function IntegracoesPage() {
  const { token, pode } = useAuth();
  const podeCriar = pode(PERMISSOES.INTEGRACOES_CRIAR);
  const podeEditar = pode(PERMISSOES.INTEGRACOES_EDITAR);
  const podeExcluir = pode(PERMISSOES.INTEGRACOES_EXCLUIR);
  const qc = useQueryClient();

  const [busca, setBusca] = useState('');
  const [filtroApp, setFiltroApp] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [emEdicao, setEmEdicao] = useState<Integracao | null>(null);
  /** App escolhido na vitrine; `''` = fechado. */
  const [criando, setCriando] = useState('');
  const [vendoEnvios, setVendoEnvios] = useState<Integracao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const catalogo = useQuery({
    queryKey: ['integracoes-catalogo'],
    enabled: !!token,
    queryFn: () =>
      api<AppIntegracao[]>('/painel/integracoes/catalogo', { token: token! }),
  });

  const integracoes = useQuery({
    queryKey: ['integracoes'],
    enabled: !!token,
    queryFn: () => api<Integracao[]>('/painel/integracoes', { token: token! }),
  });

  const apps = useMemo(() => catalogo.data ?? [], [catalogo.data]);
  const nomeApp = (tipo: string) => apps.find((a) => a.tipo === tipo)?.nome ?? tipo;

  const testar = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api<{ ok: boolean }>(`/painel/integracoes/${p.id}/testar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () =>
      setAviso('Teste aceito pelo app: credencial e formato do pedido estão corretos.'),
    onError: (e) => setAviso(erroMsg(e)),
  });

  const remover = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api(`/painel/integracoes/${p.id}`, {
        token: token!,
        method: 'DELETE',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () => {
      setAviso(null);
      void qc.invalidateQueries({ queryKey: ['integracoes'] });
    },
    onError: (e) => setAviso(erroMsg(e)),
  });

  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (integracoes.data ?? []).filter((i) => {
      const casaBusca = !termo || i.nome.toLowerCase().includes(termo);
      const casaApp = !filtroApp || i.tipo === filtroApp;
      const casaAtivo =
        !filtroAtivo || (filtroAtivo === 'ativo' ? i.ativo : !i.ativo);
      return casaBusca && casaApp && casaAtivo;
    });
  }, [integracoes.data, busca, filtroApp, filtroAtivo]);

  const colunas: Coluna<Integracao>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: (i) => (
        <div>
          <span className="font-medium">{i.nome}</span>
          {i.modoTeste && (
            <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
              modo teste
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'tipo',
      titulo: 'App',
      render: (i) => {
        const app = apps.find((a) => a.tipo === i.tipo);
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            {app && <LogoApp app={app} tamanho="sm" />}
            {nomeApp(i.tipo)}
          </span>
        );
      },
    },
    {
      chave: 'eventos',
      titulo: 'Eventos',
      render: (i) => (
        <span className="text-xs opacity-60">
          {(i.eventos.length
            ? i.eventos
            : Object.keys(ROTULO_EVENTO_INTEGRACAO)
          )
            .map((ev) => ROTULO_EVENTO_INTEGRACAO[ev as EventoIntegracao] ?? ev)
            .join(' · ')}
        </span>
      ),
    },
    {
      // Somente leitura: mudar situação é dentro da edição, nunca na listagem.
      chave: 'ativo',
      titulo: 'Situação',
      render: (i) => <BadgeSituacao situacao={i.ativo ? 'ATIVO' : 'INATIVO'} />,
    },
    {
      chave: 'ultimoEnvio',
      titulo: 'Último envio',
      render: (i) =>
        i.ultimoEnvio ? (
          <div className="flex flex-col gap-1">
            <BadgeSituacao situacao={i.ultimoEnvio.situacao} />
            <span className="text-[11px] opacity-60">{dataHora(i.ultimoEnvio.em)}</span>
          </div>
        ) : (
          <span className="text-xs opacity-50">nenhum</span>
        ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (i) => (
        <div className="flex flex-wrap justify-end gap-3 text-xs">
          <button
            type="button"
            onClick={() => setVendoEnvios(i)}
            className="underline opacity-70 hover:opacity-100"
          >
            Envios
          </button>
          {podeEditar && (
            <>
              {/*
                Só para app que sabe receber um envio de teste. Sem isso, o
                clique geraria uma conversão REAL no relatório do lojista.
              */}
              {apps.find((a) => a.tipo === i.tipo)?.suportaTeste && (
                <button
                  type="button"
                  onClick={async () => {
                    setAviso(null);
                    const codigoTotp = await pedirCodigoTotp();
                    if (!codigoTotp) return;
                    testar.mutate({ id: i.id, codigoTotp });
                  }}
                  disabled={testar.isPending}
                  className="underline opacity-70 hover:opacity-100 disabled:opacity-40"
                >
                  Testar
                </button>
              )}
              <button
                type="button"
                onClick={() => setEmEdicao(i)}
                className="text-accent underline"
              >
                Editar
              </button>
            </>
          )}
          {podeExcluir && (
            <button
              type="button"
              onClick={async () => {
                if (
                  await confirmarAcao({
                    titulo: `Desconectar "${i.nome}"?`,
                    mensagem:
                      'As vendas deixam de ser enviadas para o app. O histórico de envios é mantido.',
                    perigo: true,
                    rotuloConfirmar: 'Desconectar',
                  })
                ) {
                  const codigoTotp = await pedirCodigoTotp();
                  if (!codigoTotp) return;
                  remover.mutate({ id: i.id, codigoTotp });
                }
              }}
              disabled={remover.isPending}
              className="text-red-600 underline disabled:opacity-40"
            >
              Desconectar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Integrações</h1>
          <p className="mt-1 text-sm opacity-70">
            Configure as integrações com os seus apps.
          </p>
        </div>
        {podeCriar && (
          <button
            type="button"
            onClick={() => {
              setAviso(null);
              setCriando(apps[0]?.tipo ?? 'UTMIFY');
            }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Adicionar
          </button>
        )}
      </div>

      {aviso && (
        <p className="mt-4 rounded-md border border-ink-800/10 bg-ink-800/[0.03] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          {aviso}
        </p>
      )}

      {/*
        Vitrine: o app é a entrada da tela, não uma opção escondida num select.
        Clicar no card já abre o formulário com aquele app escolhido — e é aqui
        que app novo aparece sozinho, porque a grade é o `CATALOGO_INTEGRACOES`.
      */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-60">
          Apps disponíveis
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const conectadas = (integracoes.data ?? []).filter(
              (i) => i.tipo === app.tipo && i.ativo,
            ).length;
            return (
              <button
                key={app.tipo}
                type="button"
                disabled={!podeCriar}
                onClick={() => {
                  setAviso(null);
                  setCriando(app.tipo);
                }}
                className="group flex items-start gap-4 rounded-xl border border-ink-800/10 bg-white p-4 text-left transition hover:border-accent/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-ink-900"
              >
                <LogoApp app={app} tamanho="lg" />
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{app.nome}</p>
                  <p className="mt-0.5 text-xs opacity-70">{app.resumo}</p>
                  <span
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: app.corMarca }}
                  >
                    {conectadas
                      ? `${conectadas} conectada${conectadas > 1 ? 's' : ''} · adicionar outra`
                      : 'Conectar'}
                    <span aria-hidden className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
          {!apps.length && (
            <p className="text-sm opacity-60">Carregando apps disponíveis…</p>
          )}
        </div>
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide opacity-60">
        Suas integrações
      </h2>
      <div className="mt-3">
        <BarraFiltros>
          <FiltroTexto
            label="Pesquisar"
            value={busca}
            onChange={setBusca}
            placeholder="Nome da integração"
          />
          <FiltroSelect label="App" value={filtroApp} onChange={setFiltroApp}>
            <option value="">Todos</option>
            {apps.map((a) => (
              <option key={a.tipo} value={a.tipo}>
                {a.nome}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect label="Situação" value={filtroAtivo} onChange={setFiltroAtivo}>
            <option value="">Todas</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </FiltroSelect>
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={dadosFiltrados}
          chave={(i) => i.id}
          carregando={integracoes.isLoading}
          tamanhoPagina={10}
          vazio="Nenhum registro encontrado."
        />
      </div>

      {(criando || emEdicao) && (
        <ModalIntegracao
          apps={apps}
          integracao={emEdicao}
          tipoInicial={criando}
          onFechar={() => {
            setCriando('');
            setEmEdicao(null);
          }}
        />
      )}

      {vendoEnvios && (
        <ModalEnvios integracao={vendoEnvios} onFechar={() => setVendoEnvios(null)} />
      )}
    </Shell>
  );
}

/** Cadastro e edição. Mesmo formulário: a diferença é a credencial obrigatória. */
function ModalIntegracao({
  apps,
  integracao,
  tipoInicial,
  onFechar,
}: {
  apps: AppIntegracao[];
  integracao: Integracao | null;
  /** App escolhido na vitrine. */
  tipoInicial: string;
  onFechar: () => void;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const editando = !!integracao;

  const [tipo, setTipo] = useState(
    integracao?.tipo ?? tipoInicial ?? apps[0]?.tipo ?? 'UTMIFY',
  );
  const [nome, setNome] = useState(integracao?.nome ?? '');
  const [credencial, setCredencial] = useState('');
  const [eventos, setEventos] = useState<string[]>(
    integracao?.eventos ?? eventosPadraoDoApp(tipoInicial),
  );
  const [modoTeste, setModoTeste] = useState(integracao?.modoTeste ?? false);
  const [ativo, setAtivo] = useState(integracao?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const app = apps.find((a) => a.tipo === tipo);
  const disponiveis = app?.eventos ?? [];
  // Lista vazia = todos: é o que a API assume, então a tela mostra tudo marcado.
  const selecionados = eventos.length ? eventos : disponiveis;

  const salvar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api(
        editando ? `/painel/integracoes/${integracao!.id}` : '/painel/integracoes',
        {
          token: token!,
          method: editando ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...(editando ? {} : { tipo }),
            nome,
            eventos: selecionados,
            modoTeste,
            ativo,
            codigoTotp,
            ...(credencial.trim() ? { credencial: credencial.trim() } : {}),
          }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integracoes'] });
      onFechar();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  function toggleEvento(ev: string) {
    const base = selecionados;
    setEventos(base.includes(ev) ? base.filter((e) => e !== ev) : [...base, ev]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const codigoTotp = await pedirCodigoTotp();
    if (!codigoTotp) return;
    salvar.mutate(codigoTotp);
  }

  return (
    <Modal
      open
      onClose={onFechar}
      largura="lg"
      title={editando ? 'Editar integração' : 'Adicionar integração'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <TextoRotulo obrigatorio>App</TextoRotulo>
            <select
              className={INPUT}
              value={tipo}
              onChange={(e) => {
                const novo = e.target.value;
                setTipo(novo);
                // Cada app tem o seu padrão de eventos e as suas capacidades —
                // levar a escolha do app anterior gravaria, por exemplo, "modo
                // teste" numa integração que não tem teste nenhum.
                setEventos(eventosPadraoDoApp(novo));
                setCredencial('');
                if (!apps.find((a) => a.tipo === novo)?.suportaTeste) setModoTeste(false);
              }}
              // Trocar o app de uma integração já criada deixaria o histórico de
              // envios apontando para outro destino.
              disabled={editando}
            >
              {apps.map((a) => (
                <option key={a.tipo} value={a.tipo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Nome</TextoRotulo>
            <input
              className={INPUT}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Utmify — loja principal"
              required
            />
          </label>
        </div>

        {app && (
          <div className="flex items-start gap-3 rounded-md bg-ink-800/[0.03] px-3 py-3 dark:bg-white/[0.03]">
            <LogoApp app={app} tamanho="md" />
            <p className="text-xs opacity-70">
              {app.descricao}{' '}
              <a
                href={app.site}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent underline"
              >
                {app.site.replace('https://', '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        )}

        {/*
          App sem credencial (Xtracky) não mostra o campo: pedir um segredo que
          não vai a lugar nenhum só ensinaria o lojista a inventar um valor.
        */}
        {app?.credencial && (
          <label className="block text-sm">
            <TextoRotulo obrigatorio={!editando}>{app.credencial.rotulo}</TextoRotulo>
            <input
              className={`${INPUT} font-mono`}
              value={credencial}
              onChange={(e) => setCredencial(e.target.value)}
              type="password"
              placeholder={
                editando ? 'deixe em branco para manter a atual' : 'cole o token do app'
              }
              required={!editando}
            />
            <span className="mt-1 block text-xs opacity-60">
              {app.credencial.ondeObter} · Guardamos cifrada e nunca exibimos de novo.
            </span>
          </label>
        )}

        {app?.observacao && (
          <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {app.observacao}
          </p>
        )}

        <div>
          <p className="text-xs font-medium opacity-60">Eventos enviados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {disponiveis.map((ev) => (
              <button
                key={ev}
                type="button"
                onClick={() => toggleEvento(ev)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selecionados.includes(ev)
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink-800/15 opacity-60 dark:border-white/15'
                }`}
              >
                {ROTULO_EVENTO_INTEGRACAO[ev]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Só faz sentido em app que entende envio de teste. */}
          {app?.suportaTeste && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={modoTeste}
                onChange={(e) => setModoTeste(e.target.checked)}
              />
              <span>
                Modo teste
                <span className="block text-xs opacity-60">
                  Os pedidos são enviados marcados como teste: o app valida e não grava
                  no relatório.
                </span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            <span>
              Ativo
              <span className="block text-xs opacity-60">
                Desligado, as vendas deixam de ser enviadas para este app.
              </span>
            </span>
          </label>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <ModalAcoes
          onCancelar={onFechar}
          pendente={salvar.isPending}
          desabilitado={!selecionados.length}
          rotulo={editando ? 'Salvar' : 'Adicionar'}
        />
      </form>
    </Modal>
  );
}

/** Histórico de envio: é aqui que o lojista descobre por que a venda não chegou. */
function ModalEnvios({
  integracao,
  onFechar,
}: {
  integracao: Integracao;
  onFechar: () => void;
}) {
  const { token, pode } = useAuth();
  const qc = useQueryClient();
  const podeReenviar = pode(PERMISSOES.INTEGRACOES_EDITAR);
  const [pagina, setPagina] = useState(1);
  const [situacao, setSituacao] = useState('');

  const envios = useQuery({
    queryKey: ['integracao-envios', integracao.id, pagina, situacao],
    enabled: !!token,
    queryFn: () =>
      api<{ itens: Envio[]; total: number }>(
        `/painel/integracoes/${integracao.id}/envios?page=${pagina}&limit=10` +
          (situacao ? `&situacao=${situacao}` : ''),
        { token: token! },
      ),
  });

  const reenviar = useMutation({
    mutationFn: (p: { envioId: string; codigoTotp: string }) =>
      api(`/painel/integracoes/${integracao.id}/envios/${p.envioId}/reenviar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['integracao-envios', integracao.id] }),
  });

  const colunas: Coluna<Envio>[] = [
    {
      chave: 'em',
      titulo: 'Quando',
      render: (e) => <span className="whitespace-nowrap text-xs">{dataHora(e.em)}</span>,
    },
    {
      chave: 'idTransacao',
      titulo: 'Venda',
      render: (e) => (
        <span className="block max-w-[12rem] truncate font-mono text-[11px] opacity-70">
          {e.referenciaExterna ?? e.idTransacao}
        </span>
      ),
    },
    {
      chave: 'status',
      titulo: 'Status enviado',
      render: (e) => <span className="font-mono text-[11px]">{e.status}</span>,
    },
    {
      chave: 'situacao',
      titulo: 'Resultado',
      render: (e) => (
        <div className="flex flex-col gap-1">
          <BadgeSituacao situacao={e.situacao} />
          {/*
            Mensagem em envio que DEU CERTO não é erro: é o app avisando que
            recebeu e descartou (duplicado). Pintar de vermelho ao lado de um
            badge verde faria o lojista abrir chamado por um envio que não tem
            o que consertar.
          */}
          {e.mensagemErro && (
            <span
              className={`max-w-[18rem] text-[11px] ${
                e.situacao === 'SUCESSO'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-600'
              }`}
              title={e.mensagemErro}
            >
              {e.mensagemErro}
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      render: (e) =>
        podeReenviar && e.situacao !== 'SUCESSO' ? (
          <button
            type="button"
            onClick={async () => {
              const codigoTotp = await pedirCodigoTotp();
              if (!codigoTotp) return;
              reenviar.mutate({ envioId: e.id, codigoTotp });
            }}
            disabled={reenviar.isPending}
            className="text-xs text-accent underline disabled:opacity-40"
          >
            Reenviar
          </button>
        ) : null,
    },
  ];

  return (
    <Modal open onClose={onFechar} largura="xl" title={`Envios — ${integracao.nome}`}>
      <BarraFiltros>
        <FiltroSelect
          label="Resultado"
          value={situacao}
          onChange={(v) => {
            setSituacao(v);
            setPagina(1);
          }}
        >
          <option value="">Todos</option>
          <option value="SUCESSO">Sucesso</option>
          <option value="FALHA">Falha</option>
          <option value="PENDENTE">Pendente</option>
        </FiltroSelect>
      </BarraFiltros>

      <TabelaPaginada
        colunas={colunas}
        dados={envios.data?.itens ?? []}
        chave={(e) => e.id}
        carregando={envios.isLoading}
        tamanhoPagina={10}
        total={envios.data?.total ?? 0}
        pagina={pagina}
        onPagina={setPagina}
        vazio="Nenhum envio registrado."
      />
    </Modal>
  );
}
