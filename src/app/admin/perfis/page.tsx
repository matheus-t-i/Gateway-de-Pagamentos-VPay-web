'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { Modal, ModalAcoes } from '@/components/modal';
import {
  BarraFiltros,
  FiltroSelect,
  FiltroTexto,
  SeletorPorPagina,
  TabelaPaginada,
  type Coluna,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

type PerfilLista = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  sistema: boolean;
  totalUsuarios: number;
  totalPermissoes: number;
  criadoEm: string;
};

type PerfilDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  sistema: boolean;
  totalUsuarios: number;
  permissoes: string[];
};

type AcaoCatalogo = { acao: string; codigo: string; descricao: string };
type RecursoCatalogo = {
  chave: string;
  rotulo: string;
  grupo: string;
  telas: string[];
  acoes: AcaoCatalogo[];
};
type Catalogo = {
  rotulosAcao: Record<string, string>;
  recursos: RecursoCatalogo[];
  perfisSistema: string[];
};

type Rascunho = {
  id: string | null;
  nome: string;
  descricao: string;
  ativo: boolean;
  sistema: boolean;
  permissoes: Set<string>;
};

const NOVO: Rascunho = {
  id: null,
  nome: '',
  descricao: '',
  ativo: true,
  sistema: false,
  permissoes: new Set<string>(),
};

export default function AdminPerfisPage() {
  const { token, pode } = useAuth();
  const qc = useQueryClient();

  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const podeCriar = pode(PERMISSOES.ADMIN_PERFIS_CRIAR);
  const podeEditar = pode(PERMISSOES.ADMIN_PERFIS_EDITAR);
  const podeExcluir = pode(PERMISSOES.ADMIN_PERFIS_EXCLUIR);

  useEffect(() => {
    setPagina(1);
  }, [busca, situacao, limite]);

  const query = new URLSearchParams({ page: String(pagina), limit: String(limite) });
  if (busca.trim()) query.set('busca', busca.trim());
  if (situacao) query.set('situacao', situacao);

  const perfis = useQuery({
    queryKey: ['admin-perfis', pagina, limite, busca, situacao],
    enabled: !!token,
    queryFn: () =>
      api<{ pagina: number; limite: number; total: number; itens: PerfilLista[] }>(
        `/admin/perfis?${query.toString()}`,
        { token: token! },
      ),
  });

  const catalogo = useQuery({
    queryKey: ['admin-perfis-catalogo'],
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    queryFn: () => api<Catalogo>('/admin/perfis/catalogo', { token: token! }),
  });

  const salvar = useMutation({
    mutationFn: (r: Rascunho) => {
      const corpo = {
        nome: r.nome,
        descricao: r.descricao || null,
        ativo: r.ativo,
        // ADMINISTRADOR sempre tem tudo: a API recusa mexer nas permissões dele.
        permissoes: r.nome === 'ADMINISTRADOR' ? undefined : [...r.permissoes],
      };
      return r.id
        ? api(`/admin/perfis/${r.id}`, {
            token: token!,
            method: 'PUT',
            body: JSON.stringify(corpo),
          })
        : api('/admin/perfis', {
            token: token!,
            method: 'POST',
            body: JSON.stringify(corpo),
          });
    },
    onSuccess: () => {
      setErro(null);
      setRascunho(null);
      void qc.invalidateQueries({ queryKey: ['admin-perfis'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao salvar'),
  });

  const excluir = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/perfis/${id}`, { token: token!, method: 'DELETE' }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['admin-perfis'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao excluir'),
  });

  async function abrirEdicao(id: string) {
    setErro(null);
    try {
      const d = await api<PerfilDetalhe>(`/admin/perfis/${id}`, { token: token! });
      setRascunho({
        id: d.id,
        nome: d.nome,
        descricao: d.descricao ?? '',
        ativo: d.ativo,
        sistema: d.sistema,
        permissoes: new Set(d.permissoes),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil');
    }
  }

  const colunas: Coluna<PerfilLista>[] = [
    {
      chave: 'perfil',
      titulo: 'Perfil',
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium">{p.descricao || p.nome}</p>
          <p className="font-mono text-xs opacity-60">{p.nome}</p>
          {p.sistema && (
            <span className="mt-1 inline-block rounded-full bg-ink-800/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70 dark:bg-white/10">
              Sistema
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'ativo',
      titulo: 'Situação',
      render: (p) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            p.ativo
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-ink-800/10 opacity-70 dark:bg-white/10'
          }`}
        >
          {p.ativo ? 'ATIVO' : 'INATIVO'}
        </span>
      ),
    },
    {
      chave: 'totalUsuarios',
      titulo: 'Usuários',
      render: (p) => <span className="tabular-nums">{p.totalUsuarios}</span>,
    },
    {
      chave: 'totalPermissoes',
      titulo: 'Permissões',
      render: (p) => (
        <span className="tabular-nums">
          {p.nome === 'ADMINISTRADOR' ? 'todas' : p.totalPermissoes}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (p) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void abrirEdicao(p.id)}
            className="rounded border border-ink-800/15 px-3 py-1.5 text-xs font-medium dark:border-white/15"
          >
            {podeEditar ? 'Editar' : 'Ver'}
          </button>
          {podeExcluir && !p.sistema && (
            <button
              type="button"
              disabled={excluir.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Excluir o perfil "${p.descricao || p.nome}"? Esta ação não pode ser desfeita.`,
                  )
                ) {
                  return;
                }
                excluir.mutate(p.id);
              }}
              className="rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60 dark:text-red-400"
            >
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const total = perfis.data?.total ?? 0;

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Perfis de acesso</h1>
          <p className="mt-1 text-sm opacity-70">
            Cada perfil define as telas que a pessoa abre e o que pode fazer em
            cada uma. A API recusa qualquer operação fora do perfil, mesmo com o
            token válido.
          </p>
        </div>
        {podeCriar && (
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setRascunho({ ...NOVO, permissoes: new Set<string>() });
            }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Novo perfil
          </button>
        )}
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="Nome ou descrição"
          />
          <FiltroSelect label="Situação" value={situacao} onChange={setSituacao}>
            <option value="">Todas</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </FiltroSelect>
        </BarraFiltros>

        <TabelaPaginada<PerfilLista>
          colunas={colunas}
          dados={perfis.data?.itens ?? []}
          chave={(p) => p.id}
          carregando={perfis.isLoading}
          tamanhoPagina={limite}
          total={total}
          pagina={pagina}
          onPagina={setPagina}
          vazio="Nenhum perfil encontrado."
        />
        <div className="mt-2 flex justify-end">
          <SeletorPorPagina value={limite} onChange={setLimite} />
        </div>
      </div>

      <EditorPerfil
        rascunho={rascunho}
        catalogo={catalogo.data}
        somenteLeitura={!podeEditar && !!rascunho?.id}
        pendente={salvar.isPending}
        onFechar={() => setRascunho(null)}
        onMudar={setRascunho}
        onSalvar={() => rascunho && salvar.mutate(rascunho)}
      />
    </Shell>
  );
}

/** Matriz recurso × ação, agrupada como o menu do painel. */
function EditorPerfil({
  rascunho,
  catalogo,
  somenteLeitura,
  pendente,
  onFechar,
  onMudar,
  onSalvar,
}: {
  rascunho: Rascunho | null;
  catalogo?: Catalogo;
  somenteLeitura: boolean;
  pendente: boolean;
  onFechar: () => void;
  onMudar: (r: Rascunho) => void;
  onSalvar: () => void;
}) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, RecursoCatalogo[]>();
    for (const r of catalogo?.recursos ?? []) {
      mapa.set(r.grupo, [...(mapa.get(r.grupo) ?? []), r]);
    }
    return [...mapa.entries()];
  }, [catalogo]);

  if (!rascunho) return null;

  // ADMINISTRADOR recebe o catálogo inteiro por definição (trava anti-lockout
  // na API), então a matriz dele é só informativa.
  const permissoesTravadas = rascunho.nome === 'ADMINISTRADOR';
  const bloqueado = somenteLeitura || permissoesTravadas;

  const alternar = (codigo: string, marcado: boolean) => {
    const permissoes = new Set(rascunho.permissoes);
    if (marcado) permissoes.add(codigo);
    else permissoes.delete(codigo);
    onMudar({ ...rascunho, permissoes });
  };

  const alternarRecurso = (recurso: RecursoCatalogo, marcado: boolean) => {
    const permissoes = new Set(rascunho.permissoes);
    for (const a of recurso.acoes) {
      if (marcado) permissoes.add(a.codigo);
      else permissoes.delete(a.codigo);
    }
    onMudar({ ...rascunho, permissoes });
  };

  const tem = (codigo: string) =>
    permissoesTravadas || rascunho.permissoes.has(codigo);

  return (
    <Modal
      open
      onClose={onFechar}
      largura="xl"
      title={rascunho.id ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSalvar();
        }}
        className="space-y-5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col text-xs font-medium opacity-70">
            Nome do perfil
            <input
              required
              value={rascunho.nome}
              disabled={rascunho.sistema || somenteLeitura}
              onChange={(e) => onMudar({ ...rascunho, nome: e.target.value })}
              placeholder="SUPORTE_N1"
              className="mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 font-mono text-sm font-normal opacity-100 disabled:opacity-60 dark:border-white/15 dark:bg-ink-900"
            />
            <span className="mt-1 font-normal opacity-60">
              {rascunho.sistema
                ? 'Perfil de sistema: o nome não pode mudar.'
                : 'Vira maiúsculas com _ no lugar dos espaços.'}
            </span>
          </label>
          <label className="flex flex-col text-xs font-medium opacity-70">
            Descrição
            <input
              value={rascunho.descricao}
              disabled={somenteLeitura}
              onChange={(e) => onMudar({ ...rascunho, descricao: e.target.value })}
              placeholder="Suporte nível 1"
              className="mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm font-normal opacity-100 disabled:opacity-60 dark:border-white/15 dark:bg-ink-900"
            />
            <span className="mt-1 font-normal opacity-60">
              É o rótulo mostrado nas telas.
            </span>
          </label>
        </div>

        <label className="flex flex-col text-xs font-medium opacity-70 sm:max-w-[12rem]">
          Situação
          <select
            value={rascunho.ativo ? 'ATIVO' : 'INATIVO'}
            disabled={rascunho.sistema || somenteLeitura}
            onChange={(e) => onMudar({ ...rascunho, ativo: e.target.value === 'ATIVO' })}
            className="mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm font-normal opacity-100 disabled:opacity-60 dark:border-white/15 dark:bg-ink-900"
          >
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
          <span className="mt-1 font-normal opacity-60">
            Perfil inativo perde o acesso na hora, sem esperar novo login.
          </span>
        </label>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">Permissões</h4>
            <span className="text-xs opacity-60">
              {permissoesTravadas
                ? 'ADMINISTRADOR sempre tem todas as permissões.'
                : `${rascunho.permissoes.size} selecionada(s)`}
            </span>
          </div>

          {!catalogo && (
            <p className="mt-3 text-sm opacity-60">Carregando o catálogo…</p>
          )}

          <div className="mt-3 space-y-5">
            {grupos.map(([grupo, recursos]) => (
              <div key={grupo}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-40">
                  {grupo}
                </p>
                <div className="divide-y divide-ink-800/10 rounded-lg border border-ink-800/10 dark:divide-white/10 dark:border-white/10">
                  {recursos.map((r) => {
                    const todas = r.acoes.every((a) => tem(a.codigo));
                    return (
                      <div
                        key={r.chave}
                        className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-current"
                              checked={todas}
                              disabled={bloqueado}
                              onChange={(e) => alternarRecurso(r, e.target.checked)}
                            />
                            {r.rotulo}
                          </label>
                          {!!r.telas.length && (
                            <p className="mt-0.5 pl-6 font-mono text-[11px] opacity-45">
                              {r.telas.join('  ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-6 sm:justify-end sm:pl-0">
                          {r.acoes.map((a) => (
                            <label
                              key={a.codigo}
                              title={a.descricao}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-current"
                                checked={tem(a.codigo)}
                                disabled={bloqueado}
                                onChange={(e) => alternar(a.codigo, e.target.checked)}
                              />
                              {catalogo?.rotulosAcao[a.acao] ?? a.acao}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {somenteLeitura ? (
          <div className="flex justify-start pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium dark:border-white/15"
            >
              Fechar
            </button>
          </div>
        ) : (
          <ModalAcoes onCancelar={onFechar} pendente={pendente} />
        )}
      </form>
    </Modal>
  );
}
