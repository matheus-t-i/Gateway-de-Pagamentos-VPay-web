'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
  type Coluna,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Credencial = {
  id: string;
  nome: string;
  chavePublica: string;
  escopos: string[];
  ativo: boolean;
  ipsPermitidos: string[];
  criadoEm: string;
};

type NovaCredencial = {
  id: string;
  nome: string;
  chavePublica: string;
  segredo: string;
  aviso: string;
};

export default function ChavesApiPage() {
  const { token, empresaId } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [ips, setIps] = useState('');
  const [criada, setCriada] = useState<NovaCredencial | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  const credenciais = useQuery({
    queryKey: ['credenciais', empresaId],
    enabled: !!token && !!empresaId,
    queryFn: () =>
      api<Credencial[]>(`/empresas/${empresaId}/credenciais`, { token: token! }),
  });

  const criar = useMutation({
    mutationFn: (body: { nome: string; ipsPermitidos: string[] }) =>
      api<NovaCredencial>(`/empresas/${empresaId}/credenciais`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ ...body, escopos: [] }),
      }),
    onSuccess: (nova) => {
      setCriada(nova);
      setNome('');
      setIps('');
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['credenciais', empresaId] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao criar'),
  });

  const revogar = useMutation({
    mutationFn: (id: string) =>
      api(`/empresas/${empresaId}/credenciais/${id}`, {
        token: token!,
        method: 'DELETE',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['credenciais', empresaId] }),
  });

  function onCriar(e: FormEvent) {
    e.preventDefault();
    criar.mutate({
      nome,
      ipsPermitidos: ips
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (credenciais.data ?? []).filter((c) => {
      const casaBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.chavePublica.toLowerCase().includes(termo);
      const casaSituacao =
        !situacao ||
        (situacao === 'ativa' ? c.ativo : !c.ativo);
      return casaBusca && casaSituacao;
    });
  }, [credenciais.data, busca, situacao]);

  const colunas: Coluna<Credencial>[] = [
    { chave: 'nome', titulo: 'Nome', render: (c) => <span className="font-medium">{c.nome}</span> },
    {
      chave: 'chavePublica',
      titulo: 'Chave pública',
      className: 'font-mono text-xs',
      render: (c) => c.chavePublica,
    },
    {
      chave: 'ips',
      titulo: 'IPs',
      className: 'text-xs opacity-70',
      render: (c) => (c.ipsPermitidos.length > 0 ? c.ipsPermitidos.join(', ') : '—'),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (c) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            c.ativo
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
          }`}
        >
          {c.ativo ? 'Ativa' : 'Revogada'}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (c) =>
        c.ativo ? (
          <button
            type="button"
            onClick={() => revogar.mutate(c.id)}
            className="text-xs text-red-600 underline"
          >
            Revogar
          </button>
        ) : null,
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Chaves de API</h1>
      <p className="mt-1 text-sm opacity-70">
        Credenciais para integrar seus sistemas à API do gateway.
      </p>

      {!empresaId && (
        <div className="mt-8 rounded-lg border border-dashed border-ink-800/20 p-6 text-sm opacity-70 dark:border-white/20">
          Selecione uma empresa em{' '}
          <Link href="/empresas" className="text-accent underline">
            Empresas
          </Link>{' '}
          para gerenciar chaves de API.
        </div>
      )}

      {empresaId && (
        <>
          {/* Segredo recém-criado — exibido uma única vez */}
          {criada && (
            <div className="mt-6 rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Guarde o segredo agora — ele não será exibido novamente.
              </p>
              <div className="mt-3 space-y-1 break-all font-mono text-xs">
                <p>
                  <span className="opacity-60">x-api-key:</span> {criada.chavePublica}
                </p>
                <p>
                  <span className="opacity-60">x-api-secret:</span> {criada.segredo}
                </p>
              </div>
              <button
                type="button"
                className="mt-3 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => setCriada(null)}
              >
                Já copiei, ocultar
              </button>
            </div>
          )}

          <form
            onSubmit={onCriar}
            className="mt-6 rounded-lg border border-ink-800/10 p-4 dark:border-white/10"
          >
            <h2 className="text-sm font-semibold">Nova chave</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                Nome
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: produção loja X"
                  required
                />
              </label>
              <label className="block text-sm">
                IPs permitidos (separados por vírgula, vazio = todos)
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={ips}
                  onChange={(e) => setIps(e.target.value)}
                  placeholder="203.0.113.10, 198.51.100.0/24"
                />
              </label>
            </div>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={criar.isPending}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {criar.isPending ? 'Criando…' : 'Criar chave'}
            </button>
          </form>

          <div className="mt-6">
            <BarraFiltros>
              <FiltroTexto
                label="Buscar"
                value={busca}
                onChange={setBusca}
                placeholder="Nome ou chave pública"
              />
              <FiltroSelect label="Situação" value={situacao} onChange={setSituacao}>
                <option value="">Todas</option>
                <option value="ativa">Ativa</option>
                <option value="revogada">Revogada</option>
              </FiltroSelect>
            </BarraFiltros>

            <TabelaPaginada<Credencial>
              colunas={colunas}
              dados={filtradas}
              chave={(c) => c.id}
              carregando={credenciais.isLoading}
              tamanhoPagina={10}
              vazio="Nenhuma chave criada ainda."
            />
          </div>
        </>
      )}
    </Shell>
  );
}
