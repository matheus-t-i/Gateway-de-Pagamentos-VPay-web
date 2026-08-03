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

type Tx = {
  idTransacao: string;
  direcao: string;
  situacao: string;
  valorBruto: string;
  valorLiquidacao: string;
  criadoEm: string;
};

const brl = (v: string | number) =>
  'R$ ' +
  Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const colunas: Coluna<Tx>[] = [
  { chave: 'idTransacao', titulo: 'ID', render: (t) => <span className="font-mono text-xs">#{t.idTransacao.slice(0, 8)}</span> },
  { chave: 'direcao', titulo: 'Direção' },
  { chave: 'situacao', titulo: 'Situação' },
  { chave: 'valorBruto', titulo: 'Valor', render: (t) => brl(t.valorBruto) },
  { chave: 'criadoEm', titulo: 'Criado em', render: (t) => new Date(t.criadoEm).toLocaleString('pt-BR') },
];

export default function TransacoesPage() {
  const { token, empresaId, setEmpresaId } = useAuth();
  const empresas = useQuery({
    queryKey: ['empresas'],
    enabled: !!token,
    queryFn: () =>
      api<Array<{ idPublico: string; razaoSocial: string }>>('/empresas', {
        token: token!,
      }),
  });

  const txs = useQuery({
    queryKey: ['transacoes', empresaId],
    enabled: !!token && !!empresaId,
    queryFn: () =>
      api<Tx[]>('/painel/transacoes', { token: token!, empresaId: empresaId! }),
  });

  const [fSituacao, setFSituacao] = useState('');
  const [fDirecao, setFDirecao] = useState('');
  const [busca, setBusca] = useState('');

  const situacoes = useMemo(
    () => Array.from(new Set((txs.data ?? []).map((t) => t.situacao))).sort(),
    [txs.data],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (txs.data ?? []).filter(
      (t) =>
        (!fSituacao || t.situacao === fSituacao) &&
        (!fDirecao || t.direcao === fDirecao) &&
        (!q || t.idTransacao.toLowerCase().includes(q)),
    );
  }, [txs.data, fSituacao, fDirecao, busca]);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Transações</h1>
          <p className="mt-1 text-sm opacity-70">Listagem por empresa selecionada.</p>
        </div>
        <label className="text-sm">
          Empresa
          <select
            className="ml-2 rounded border border-ink-800/15 bg-white px-2 py-1 dark:border-white/10 dark:bg-ink-900"
            value={empresaId ?? ''}
            onChange={(e) => setEmpresaId(e.target.value || null)}
          >
            <option value="">Selecione</option>
            {empresas.data?.map((e) => (
              <option key={e.idPublico} value={e.idPublico}>
                {e.razaoSocial}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        {empresaId && (
          <BarraFiltros>
            <FiltroSelect label="Situação" value={fSituacao} onChange={setFSituacao}>
              <option value="">Todas</option>
              {situacoes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FiltroSelect>
            <FiltroSelect label="Direção" value={fDirecao} onChange={setFDirecao}>
              <option value="">Todas</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </FiltroSelect>
            <FiltroTexto label="Buscar por ID" value={busca} onChange={setBusca} placeholder="idTransacao" />
            {(fSituacao || fDirecao || busca) && (
              <button
                type="button"
                className="text-sm text-accent underline"
                onClick={() => {
                  setFSituacao('');
                  setFDirecao('');
                  setBusca('');
                }}
              >
                Limpar
              </button>
            )}
          </BarraFiltros>
        )}

        <TabelaPaginada
          colunas={colunas}
          dados={filtradas}
          chave={(t) => t.idTransacao}
          carregando={txs.isLoading}
          vazio={empresaId ? 'Nenhuma transação para os filtros.' : 'Selecione uma empresa.'}
          tamanhoPagina={10}
        />
      </div>
    </Shell>
  );
}
