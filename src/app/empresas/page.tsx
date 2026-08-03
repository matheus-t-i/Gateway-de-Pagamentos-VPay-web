'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  Coluna,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';

type Empresa = {
  idPublico: string;
  cnpj: string;
  razaoSocial: string;
  situacao: string;
  saldo: { disponivel: string } | null;
};

export default function EmpresasPage() {
  const { token, setEmpresaId } = useAuth();
  const empresas = useQuery({
    queryKey: ['empresas'],
    enabled: !!token,
    queryFn: () => api<Empresa[]>('/empresas', { token: token! }),
  });

  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('');

  const situacoes = useMemo(
    () => Array.from(new Set((empresas.data ?? []).map((e) => e.situacao))).sort(),
    [empresas.data],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (empresas.data ?? []).filter(
      (e) =>
        (!fSituacao || e.situacao === fSituacao) &&
        (!q ||
          e.razaoSocial.toLowerCase().includes(q) ||
          e.cnpj.toLowerCase().includes(q)),
    );
  }, [empresas.data, busca, fSituacao]);

  const colunas: Coluna<Empresa>[] = [
    { chave: 'razaoSocial', titulo: 'Empresa', render: (e) => <span className="font-medium">{e.razaoSocial}</span> },
    { chave: 'cnpj', titulo: 'Documento', render: (e) => formatarDocumento(e.cnpj) },
    { chave: 'situacao', titulo: 'Situação' },
    { chave: 'saldo', titulo: 'Disponível', render: (e) => `R$ ${e.saldo?.disponivel ?? '—'}` },
    {
      chave: 'acao',
      titulo: '',
      render: (e) => (
        <button
          type="button"
          className="rounded bg-accent px-3 py-1.5 text-xs text-accent-foreground"
          onClick={() => setEmpresaId(e.idPublico)}
        >
          Selecionar
        </button>
      ),
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Empresas</h1>
      <p className="mt-1 text-sm opacity-70">Unidades financeiras vinculadas à sua conta.</p>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto label="Buscar" value={busca} onChange={setBusca} placeholder="Nome ou documento" />
          <FiltroSelect label="Situação" value={fSituacao} onChange={setFSituacao}>
            <option value="">Todas</option>
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FiltroSelect>
          {(busca || fSituacao) && (
            <button
              type="button"
              className="text-sm text-accent underline"
              onClick={() => {
                setBusca('');
                setFSituacao('');
              }}
            >
              Limpar
            </button>
          )}
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={filtradas}
          chave={(e) => e.idPublico}
          carregando={empresas.isLoading}
          vazio="Nenhuma empresa."
          tamanhoPagina={10}
        />
      </div>
    </Shell>
  );
}
