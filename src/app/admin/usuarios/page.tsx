'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { Shell } from '@/components/shell';
import { ConfigPadraoModal } from '@/components/config-padrao-modal';
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
import { formatarDocumento } from '@/lib/documento';
import { PERMISSOES } from '@/lib/permissoes';

type Usuario = {
  idPublico: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  tipoPessoa: string | null;
  situacao: string;
  papeis: string[];
};
type Resposta = { pagina: number; limite: number; total: number; itens: Usuario[] };

const SITUACOES = [
  'PENDENTE',
  'EM_ANALISE',
  'ATIVO',
  'REPROVADO',
  'SUSPENSO',
  'BLOQUEADO',
  'ENCERRADO',
];

const corSituacao = (s: string) => {
  if (s === 'ATIVO') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (['SUSPENSO', 'EM_ANALISE', 'PENDENTE'].includes(s))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
};

export default function UsuariosAdminPage() {
  const { token, pode } = useAuth();
  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [padraoAberto, setPadraoAberto] = useState(false);

  const reset = () => setPagina(1);

  const q = useQuery({
    queryKey: ['usuarios-gestao', busca, fSituacao, pagina, limite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(pagina), limit: String(limite) });
      if (busca) p.set('busca', busca);
      if (fSituacao) p.set('situacao', fSituacao);
      return api<Resposta>(`/admin/usuarios/gestao?${p.toString()}`, { token: token! });
    },
  });

  const colunas: Coluna<Usuario>[] = [
    {
      chave: 'nome',
      titulo: 'Usuário',
      render: (u) => (
        <div>
          <p className="font-medium">{u.nome}</p>
          <p className="text-xs opacity-60">{u.email}</p>
        </div>
      ),
    },
    { chave: 'cpfCnpj', titulo: 'Documento', render: (u) => formatarDocumento(u.cpfCnpj) },
    { chave: 'tipoPessoa', titulo: 'Tipo', render: (u) => u.tipoPessoa ?? '—' },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (u) => (
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${corSituacao(u.situacao)}`}>
          {u.situacao}
        </span>
      ),
    },
    {
      chave: 'editar',
      titulo: '',
      render: (u) => (
        <Link
          href={`/admin/usuarios/${u.idPublico}`}
          className="inline-block rounded-md border border-ink-800/15 px-3 py-1 text-xs font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Usuários</h1>
          <p className="mt-1 text-sm opacity-70">
            Gestão de cadastros: status, taxas, liberação de saldo, reserva, MED e
            adquirente de roteamento por usuário.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPadraoAberto(true)}
          className="inline-flex items-center gap-2 rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Padrão de novos clientes
        </button>
      </div>

      {token && (
        <ConfigPadraoModal
          open={padraoAberto}
          token={token}
          podeEditar={pode(PERMISSOES.ADMIN_USUARIOS_EDITAR)}
          onClose={() => setPadraoAberto(false)}
        />
      )}

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto label="Buscar" value={busca} onChange={(v) => { setBusca(v); reset(); }} placeholder="nome, e-mail ou documento" />
          <FiltroSelect label="Situação" value={fSituacao} onChange={(v) => { setFSituacao(v); reset(); }}>
            <option value="">Todas</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FiltroSelect>
          <div className="ml-auto self-end">
            <SeletorPorPagina value={limite} onChange={(n) => { setLimite(n); reset(); }} />
          </div>
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={q.data?.itens ?? []}
          chave={(u) => u.idPublico}
          carregando={q.isLoading}
          vazio="Nenhum usuário."
          tamanhoPagina={limite}
          total={q.data?.total ?? 0}
          pagina={pagina}
          onPagina={setPagina}
        />
      </div>
    </Shell>
  );
}
