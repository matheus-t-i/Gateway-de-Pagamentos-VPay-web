'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, TabelaPaginada, type Coluna } from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';

type ChavePix = {
  idPublico: string;
  apelido: string | null;
  chave: string;
  tipoChave: string;
  nomeTitular: string | null;
  situacao: string;
  motivoReprovacao: string | null;
  criadoEm: string;
  empresa: { idPublico: string; razaoSocial: string; cnpj: string; situacao: string };
};

const FILTROS = ['PENDENTE', 'APROVADA', 'REPROVADA'] as const;

const badge: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  APROVADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  REPROVADA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

export default function AdminChavesPixPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<string>('PENDENTE');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const chaves = useQuery({
    queryKey: ['admin-chaves-pix', situacao],
    enabled: !!token,
    queryFn: () =>
      api<ChavePix[]>(`/admin/chaves-pix?situacao=${situacao}`, { token: token! }),
  });

  const decidir = useMutation({
    mutationFn: (p: { id: string; situacao: 'APROVADA' | 'REPROVADA'; motivo?: string }) =>
      api(`/admin/chaves-pix/${p.id}/decidir`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ situacao: p.situacao, motivo: p.motivo }),
      }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['admin-chaves-pix'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha na decisão'),
  });

  const dados = useMemo(() => {
    const lista = chaves.data ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (c) =>
        c.chave.toLowerCase().includes(q) ||
        c.empresa.razaoSocial.toLowerCase().includes(q),
    );
  }, [chaves.data, busca]);

  const colunas: Coluna<ChavePix>[] = [
    {
      chave: 'empresa',
      titulo: 'Empresa',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium">{c.empresa.razaoSocial}</p>
          <p className="text-xs opacity-60">{formatarDocumento(c.empresa.cnpj)}</p>
          <p className="text-xs opacity-50">
            {new Date(c.criadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
      ),
    },
    {
      chave: 'chave',
      titulo: 'Chave',
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{c.chave}</p>
          {c.apelido && <p className="text-xs opacity-60">{c.apelido}</p>}
          {c.nomeTitular && (
            <p className="text-xs opacity-70">Titular: {c.nomeTitular}</p>
          )}
        </div>
      ),
    },
    { chave: 'tipoChave', titulo: 'Tipo' },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (c) => (
        <div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[c.situacao] ?? ''}`}
          >
            {c.situacao}
          </span>
          {c.motivoReprovacao && (
            <p className="mt-1 text-xs text-red-600">{c.motivoReprovacao}</p>
          )}
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (c) =>
        c.situacao === 'PENDENTE' ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={decidir.isPending}
              onClick={() => decidir.mutate({ id: c.idPublico, situacao: 'APROVADA' })}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Aprovar
            </button>
            <button
              type="button"
              disabled={decidir.isPending}
              onClick={() => {
                const motivo = window.prompt('Motivo da reprovação:');
                if (!motivo?.trim()) return;
                decidir.mutate({
                  id: c.idPublico,
                  situacao: 'REPROVADA',
                  motivo: motivo.trim(),
                });
              }}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Reprovar
            </button>
          </div>
        ) : (
          <span className="text-xs opacity-40">—</span>
        ),
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Chaves PIX</h1>
      <p className="mt-1 text-sm opacity-70">
        Saque pelo painel só é liberado com chave aprovada. Confira o titular
        contra a documentação do cadastro antes de aprovar.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSituacao(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              situacao === s
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-ink-800/15 opacity-70 dark:border-white/15'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="Chave ou razão social"
          />
        </BarraFiltros>

        <TabelaPaginada<ChavePix>
          colunas={colunas}
          dados={dados}
          chave={(c) => c.idPublico}
          carregando={chaves.isLoading}
          tamanhoPagina={10}
          seletorTamanho
          vazio={`Nenhuma chave com situação ${situacao}.`}
        />
      </div>
    </Shell>
  );
}
