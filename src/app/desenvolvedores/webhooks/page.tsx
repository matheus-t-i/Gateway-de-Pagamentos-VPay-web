'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { TextoRotulo } from '@/components/obrigatorio';
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

/** Extrai a mensagem legível do erro devolvido pela API (JSON ou texto). */
function erroMsg(e: unknown) {
  let m = e instanceof Error ? e.message : 'Falha ao criar';
  try {
    const j = JSON.parse(m) as { message?: unknown; fieldErrors?: unknown };
    if (typeof j.message === 'string') m = j.message;
    else if (j.fieldErrors && typeof j.fieldErrors === 'object') {
      m = Object.values(j.fieldErrors as Record<string, string[]>)
        .flat()
        .join(' · ');
    }
  } catch {
    /* texto puro */
  }
  return m;
}

type Webhook = {
  id: string;
  nome: string;
  urlDestino: string;
  tiposEvento: string[];
  nomeHeaderAutenticacao: string | null;
  temSegredoAutenticacao: boolean;
  ativo: boolean;
};

export default function WebhooksPage() {
  const { token, pode } = useAuth();
  const podeCriar = pode(PERMISSOES.WEBHOOKS_CRIAR);
  const podeExcluir = pode(PERMISSOES.WEBHOOKS_EXCLUIR);
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>([]);
  const [nomeHeader, setNomeHeader] = useState('');
  const [segredo, setSegredo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // A lista vem da API: `tiposEvento` é filtro de entrega, então um nome
  // divergente faria o webhook nunca receber nada.
  const eventosDisponiveis = useQuery({
    queryKey: ['webhook-eventos'],
    enabled: !!token,
    queryFn: () => api<string[]>('/painel/webhooks/eventos', { token: token! }),
  });

  const todosEventos = useMemo(() => eventosDisponiveis.data ?? [], [eventosDisponiveis.data]);
  const selecionados = eventos.length ? eventos : todosEventos;

  const webhooks = useQuery({
    queryKey: ['webhooks'],
    enabled: !!token,
    queryFn: () => api<Webhook[]>('/painel/webhooks', { token: token! }),
  });

  const criar = useMutation({
    mutationFn: () =>
      api('/painel/webhooks', {
        token: token!,
        method: 'POST',
        body: JSON.stringify({
          nome,
          urlDestino: url,
          tiposEvento: selecionados,
          ativo: true,
          ...(nomeHeader.trim()
            ? { nomeHeaderAutenticacao: nomeHeader.trim(), segredoAutenticacao: segredo }
            : {}),
        }),
      }),
    onSuccess: () => {
      setNome('');
      setUrl('');
      setNomeHeader('');
      setSegredo('');
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const remover = useMutation({
    mutationFn: (id: string) =>
      api(`/painel/webhooks/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  function toggleEvento(ev: string) {
    const base = eventos.length ? eventos : todosEventos;
    setEventos(base.includes(ev) ? base.filter((e) => e !== ev) : [...base, ev]);
  }

  function onCriar(e: FormEvent) {
    e.preventDefault();
    criar.mutate();
  }

  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (webhooks.data ?? []).filter((w) => {
      const casaBusca =
        !termo ||
        w.nome.toLowerCase().includes(termo) ||
        w.urlDestino.toLowerCase().includes(termo);
      const casaAtivo =
        !filtroAtivo ||
        (filtroAtivo === 'ativo' ? w.ativo : !w.ativo);
      return casaBusca && casaAtivo;
    });
  }, [webhooks.data, busca, filtroAtivo]);

  const colunas: Coluna<Webhook>[] = [
    { chave: 'nome', titulo: 'Nome', render: (w) => <span className="font-medium">{w.nome}</span> },
    {
      chave: 'urlDestino',
      titulo: 'URL destino',
      render: (w) => (
        <span className="block max-w-[16rem] truncate font-mono text-xs opacity-70">
          {w.urlDestino}
        </span>
      ),
    },
    {
      chave: 'tiposEvento',
      titulo: 'Tipos de evento',
      render: (w) => (
        <span className="text-xs opacity-60">{w.tiposEvento.join(' · ')}</span>
      ),
    },
    {
      chave: 'autenticacao',
      titulo: 'Validação',
      render: (w) =>
        w.nomeHeaderAutenticacao && w.temSegredoAutenticacao ? (
          <span className="font-mono text-xs">{w.nomeHeaderAutenticacao}</span>
        ) : (
          <span className="text-xs opacity-50">sem header</span>
        ),
    },
    {
      chave: 'ativo',
      titulo: 'Ativo',
      render: (w) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            w.ativo
              ? 'bg-accent/10 text-accent'
              : 'bg-ink-800/10 opacity-60 dark:bg-white/10'
          }`}
        >
          {w.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (w) =>
        podeExcluir ? (
          <button
            type="button"
            onClick={() => remover.mutate(w.id)}
            disabled={remover.isPending}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Remover
          </button>
        ) : null,
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Webhooks</h1>
      <p className="mt-1 text-sm opacity-70">
        Receba callbacks quando suas transações mudarem de status.
      </p>


          <form
            onSubmit={onCriar}
            hidden={!podeCriar}
            className="mt-6 rounded-lg border border-ink-800/10 p-4 dark:border-white/10"
          >
            <h2 className="text-sm font-semibold">Novo webhook</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Nome</TextoRotulo>
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: ERP produção"
                  required
                />
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>URL de destino</TextoRotulo>
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  placeholder="https://seusite.com/webhooks/vpay"
                  required
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                Header de validação (opcional)
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-ink-900"
                  value={nomeHeader}
                  onChange={(e) => setNomeHeader(e.target.value)}
                  placeholder="x-key-token"
                />
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio={!!nomeHeader.trim()}>
                  Valor da credencial
                </TextoRotulo>
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-ink-900"
                  value={segredo}
                  onChange={(e) => setSegredo(e.target.value)}
                  type="password"
                  placeholder="mínimo 8 caracteres"
                  required={!!nomeHeader.trim()}
                />
              </label>
            </div>
            <p className="mt-2 text-xs opacity-60">
              Enviamos esse header nos callbacks deste webhook para você conferir a
              origem. Ele não é usado na <code className="font-mono">urlCallback</code>{' '}
              informada na criação do PIX — essa vai sem autenticação. O valor é
              guardado cifrado e não é exibido de novo; para trocá-lo, cadastre o
              webhook novamente.
            </p>

            <p className="mt-4 text-xs font-medium opacity-60">Eventos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {todosEventos.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvento(ev)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                    selecionados.includes(ev)
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-ink-800/15 opacity-60 dark:border-white/15'
                  }`}
                >
                  {ev}
                </button>
              ))}
              {!todosEventos.length && (
                <span className="text-xs opacity-60">Carregando eventos…</span>
              )}
            </div>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={criar.isPending || selecionados.length === 0}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {criar.isPending ? 'Salvando…' : 'Criar webhook'}
            </button>
          </form>

          <div className="mt-6">
            <BarraFiltros>
              <FiltroTexto
                label="Buscar"
                value={busca}
                onChange={setBusca}
                placeholder="Nome ou URL"
              />
              <FiltroSelect label="Ativo" value={filtroAtivo} onChange={setFiltroAtivo}>
                <option value="">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </FiltroSelect>
            </BarraFiltros>

            <TabelaPaginada
              colunas={colunas}
              dados={dadosFiltrados}
              chave={(w) => w.id}
              carregando={webhooks.isLoading}
              tamanhoPagina={10}
              vazio="Nenhum webhook configurado."
            />
          </div>
    </Shell>
  );
}
