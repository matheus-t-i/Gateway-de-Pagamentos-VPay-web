'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { Modal } from '@/components/modal';
import { api } from '@/lib/api';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type UsuarioGestao = {
  idPublico: string;
  nome: string;
  email: string;
  situacao: string;
  papeis: string[];
};

const input =
  'w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40';

function msgErro(e: unknown) {
  return e instanceof Error ? e.message : 'Falha na operação';
}

/**
 * Quem tem este perfil, e a inclusão/remoção de pessoas nele.
 *
 * Mora aqui — e não na ficha do usuário — porque conceder perfil é distribuir
 * poder: a tela exige `admin.perfis.editar`, a mesma permissão que a API cobra.
 * Quem administra contas (taxas, limites, situação) não promove ninguém.
 */
export function MembrosPerfil({
  perfil,
  token,
  podeEditar,
  onFechar,
}: {
  perfil: { nome: string; descricao: string | null };
  token: string;
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // A listagem de gestão já devolve os papéis de cada usuário; filtramos aqui
  // para não precisar de endpoint novo só para "membros deste perfil".
  const chave = ['perfil-membros', perfil.nome, busca];
  const q = useQuery({
    queryKey: chave,
    queryFn: () =>
      api<{ itens: UsuarioGestao[]; total: number }>(
        `/admin/usuarios/gestao?limit=500${busca.trim() ? `&busca=${encodeURIComponent(busca.trim())}` : ''}`,
        { token },
      ),
  });

  const { membros, naoMembros } = useMemo(() => {
    const itens = q.data?.itens ?? [];
    return {
      membros: itens.filter((u) => u.papeis.includes(perfil.nome)),
      naoMembros: itens.filter((u) => !u.papeis.includes(perfil.nome)),
    };
  }, [q.data, perfil.nome]);

  const alterar = useMutation({
    mutationFn: (v: {
      usuario: UsuarioGestao;
      incluir: boolean;
      codigoTotp: string;
    }) => {
      const perfis = v.incluir
        ? [...v.usuario.papeis, perfil.nome]
        : v.usuario.papeis.filter((p) => p !== perfil.nome);
      return api(`/admin/usuarios/${v.usuario.idPublico}/perfis`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ perfis, codigoTotp: v.codigoTotp }),
      });
    },
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['perfil-membros'] });
      void qc.invalidateQueries({ queryKey: ['admin-perfis'] });
    },
    onError: (e) => setErro(msgErro(e)),
  });

  const titulo = `Quem tem o perfil ${perfil.descricao || perfil.nome}`;

  return (
    <Modal open onClose={onFechar} title={titulo} largura="lg">
      <div className="space-y-4">
        <p className="text-xs opacity-60">
          A mudança vale na requisição seguinte — a pessoa não precisa sair e
          entrar de novo.
        </p>

        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            className={`${input} pl-9`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou documento"
          />
        </label>

        {erro && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {erro}
          </p>
        )}

        {q.isLoading ? (
          <p className="text-sm opacity-60">Carregando usuários…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
                Com este perfil ({membros.length})
              </p>
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {membros.map((u) => (
                  <li
                    key={u.idPublico}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink-800/10 px-3 py-2 dark:border-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{u.nome}</span>
                      <span className="block truncate text-xs opacity-55">{u.email}</span>
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label={`Remover ${u.nome} do perfil`}
                        disabled={alterar.isPending}
                        onClick={() => {
                          const codigoTotp = pedirCodigoTotp();
                          if (!codigoTotp) return;
                          alterar.mutate({ usuario: u, incluir: false, codigoTotp });
                        }}
                        className="shrink-0 rounded-full p-1 text-red-600 opacity-70 transition hover:bg-red-500/10 hover:opacity-100 disabled:opacity-30 dark:text-red-400"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
                {!membros.length && (
                  <li className="rounded-lg border border-dashed border-ink-800/15 px-3 py-4 text-center text-xs opacity-55 dark:border-white/15">
                    Ninguém com este perfil{busca.trim() ? ' nesta busca' : ''}.
                  </li>
                )}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
                Adicionar ao perfil
              </p>
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {naoMembros.slice(0, 50).map((u) => (
                  <li
                    key={u.idPublico}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink-800/10 px-3 py-2 dark:border-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{u.nome}</span>
                      <span className="block truncate text-xs opacity-55">
                        {u.email}
                        {u.papeis.length > 0 && ` · ${u.papeis.join(', ')}`}
                      </span>
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label={`Adicionar ${u.nome} ao perfil`}
                        disabled={alterar.isPending}
                        onClick={() => {
                          const codigoTotp = pedirCodigoTotp();
                          if (!codigoTotp) return;
                          alterar.mutate({ usuario: u, incluir: true, codigoTotp });
                        }}
                        className="shrink-0 rounded-full p-1 opacity-70 transition hover:bg-accent/20 hover:opacity-100 disabled:opacity-30"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
                {!naoMembros.length && (
                  <li className="rounded-lg border border-dashed border-ink-800/15 px-3 py-4 text-center text-xs opacity-55 dark:border-white/15">
                    Nenhum usuário fora deste perfil{busca.trim() ? ' nesta busca' : ''}.
                  </li>
                )}
                {naoMembros.length > 50 && (
                  <li className="px-1 pt-1 text-center text-[11px] opacity-50">
                    Mostrando 50 de {naoMembros.length} — use a busca para achar quem
                    você precisa.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {!podeEditar && (
          <p className="text-sm opacity-60">
            Seu perfil de acesso permite consultar, mas não alterar os membros.
          </p>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
