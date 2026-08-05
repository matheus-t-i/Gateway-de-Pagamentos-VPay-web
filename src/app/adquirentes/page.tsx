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

  const ativa = useMemo(
    () => (adquirentes.data ?? []).find((a) => a.emUso) ?? null,
    [adquirentes.data],
  );

  const colunas: Coluna<Adquirente>[] = [
    {
      chave: 'nome',
      titulo: 'Adquirente',
      render: (a) => (
        <div className="flex items-center gap-2">
          <p className="font-medium">{a.nome}</p>
          {a.emUso && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Ativa
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
        a.emUso ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Em uso no PIX in
          </span>
        ) : !podeTrocar ? null : (
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setEscolhida(a);
            }}
            className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            Trocar para esta
          </button>
        ),
    },
  ];

  return (
    <Shell>
      <div>
        <h1 className="font-display text-3xl font-semibold">Adquirentes</h1>
        <p className="mt-1 text-sm opacity-70">
          Liquidantes liberadas para a sua conta. A adquirente{' '}
          <strong>ativa</strong> gera os seus PIX de entrada; a troca vale para
          as próximas cobranças e não altera as já criadas.
        </p>
      </div>

      {!adquirentes.isLoading && (
        <div
          className={`mt-6 rounded-xl border px-4 py-4 sm:px-5 ${
            ativa
              ? 'border-emerald-500/35 bg-emerald-500/10'
              : 'border-amber-500/35 bg-amber-500/10'
          }`}
        >
          {ativa ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Adquirente ativa (PIX in)
                </p>
                <p className="mt-1 font-display text-xl font-semibold">{ativa.nome}</p>
                <p className="mt-1 text-xs opacity-70">
                  MED: {ativa.temMed ? 'sim' : 'não'}
                  {ativa.observacao ? ` · ${ativa.observacao}` : ''}
                </p>
              </div>
              {podeTrocar && (
                <p className="max-w-xs text-xs opacity-70 sm:text-right">
                  Para trocar, escolha outra adquirente na lista e confirme.
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Nenhuma adquirente ativa
              </p>
              <p className="mt-1 text-sm opacity-80">
                {podeTrocar
                  ? 'Selecione uma adquirente na lista abaixo para usar no PIX in.'
                  : 'Fale com o suporte para configurar a adquirente da sua conta.'}
              </p>
            </div>
          )}
        </div>
      )}

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
