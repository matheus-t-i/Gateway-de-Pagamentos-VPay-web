'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  Coluna,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
} from '@/components/tabela';
import { Modal, ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

type Adquirente = {
  codigo: string;
  nome: string;
  temMed: boolean;
  observacao: string | null;
  emUso: boolean;
};

/** Erro da API vem como JSON serializado no `message` — extrai o texto útil. */
function mensagemDeErro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : 'Falha';
  try {
    const j = JSON.parse(bruto) as { message?: unknown };
    if (typeof j.message === 'string') return j.message;
  } catch {
    /* texto puro */
  }
  return bruto;
}

export default function AdquirentesClientePage() {
  const { token, pode } = useAuth();
  const qc = useQueryClient();
  const podeTrocar = pode(PERMISSOES.ADQUIRENTES_EDITAR);

  const [busca, setBusca] = useState('');
  const [fMed, setFMed] = useState('');
  const [escolhida, setEscolhida] = useState<Adquirente | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const adquirentes = useQuery({
    queryKey: ['painel-adquirentes'],
    enabled: !!token,
    queryFn: () => api<Adquirente[]>('/painel/adquirentes', { token: token! }),
  });

  const trocar = useMutation({
    mutationFn: (codigo: string) =>
      api('/painel/adquirentes/pix-entrada', {
        token: token!,
        method: 'PUT',
        body: JSON.stringify({ adquirenteCodigo: codigo }),
      }),
    onSuccess: () => {
      setEscolhida(null);
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['painel-adquirentes'] });
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (adquirentes.data ?? []).filter(
      (a) =>
        (!fMed || String(a.temMed) === fMed) &&
        (!q || a.nome.toLowerCase().includes(q)),
    );
  }, [adquirentes.data, busca, fMed]);

  const colunas: Coluna<Adquirente>[] = [
    {
      chave: 'nome',
      titulo: 'Adquirente',
      render: (a) => (
        <div>
          <p className="font-medium">{a.nome}</p>
          {a.emUso && (
            <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Em uso no PIX in
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'temMed',
      titulo: 'MED',
      render: (a) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            a.temMed
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-ink-800/5 dark:bg-white/10'
          }`}
        >
          {a.temMed ? 'Sim' : 'Não'}
        </span>
      ),
    },
    {
      chave: 'observacao',
      titulo: 'Observação',
      render: (a) => (
        <span className="text-xs opacity-70">{a.observacao || '—'}</span>
      ),
    },
    {
      chave: 'acao',
      titulo: '',
      render: (a) =>
        a.emUso || !podeTrocar ? null : (
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setEscolhida(a);
            }}
            className="rounded-md border border-ink-800/15 px-3 py-1 text-xs font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Usar no PIX in
          </button>
        ),
    },
  ];

  return (
    <Shell>
      <div>
        <h1 className="font-display text-3xl font-semibold">Adquirentes</h1>
        <p className="mt-1 text-sm opacity-70">
          Liquidantes liberadas para a sua conta. A adquirente marcada como
          <strong> Em uso</strong> é a que gera os seus PIX de entrada; a troca
          vale para as próximas cobranças e não altera as já criadas.
        </p>
      </div>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="Nome da adquirente"
          />
          <FiltroSelect label="Tem MED" value={fMed} onChange={setFMed}>
            <option value="">Todas</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </FiltroSelect>
          {(busca || fMed) && (
            <button
              type="button"
              className="text-sm text-accent underline"
              onClick={() => {
                setBusca('');
                setFMed('');
              }}
            >
              Limpar
            </button>
          )}
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={filtradas}
          chave={(a) => a.codigo}
          carregando={adquirentes.isLoading}
          vazio="Nenhuma adquirente liberada para a sua conta. Fale com o suporte."
          tamanhoPagina={10}
        />
      </div>

      <Modal
        open={!!escolhida}
        onClose={() => setEscolhida(null)}
        title="Trocar adquirente de PIX in"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (escolhida) trocar.mutate(escolhida.codigo);
          }}
          className="space-y-4"
        >
          <p className="text-sm">
            Os próximos PIX de entrada passam a ser gerados na{' '}
            <strong>{escolhida?.nome}</strong>.
          </p>
          {escolhida?.observacao && (
            <p className="rounded-md bg-ink-800/5 p-2 text-xs dark:bg-white/5">
              {escolhida.observacao}
            </p>
          )}
          <p className="text-xs opacity-70">
            Tem MED: {escolhida?.temMed ? 'sim' : 'não'}. As cobranças já geradas
            continuam na adquirente em que nasceram.
          </p>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes
            onCancelar={() => setEscolhida(null)}
            rotulo="Confirmar troca"
            pendente={trocar.isPending}
          />
        </form>
      </Modal>
    </Shell>
  );
}
