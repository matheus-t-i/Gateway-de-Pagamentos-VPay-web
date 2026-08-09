'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  BarraFiltros,
  BotaoLimparFiltros,
  Coluna,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
} from '@/components/tabela';
import { Modal, ModalAcoes } from '@/components/modal';
import {
  ClientesAdquirenteModal,
  EditarAdquirenteModal,
  NovaAdquirenteModal,
} from '@/components/adquirente-modais';
import { TextoRotulo } from '@/components/obrigatorio';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type Adquirente = {
  codigo: string;
  nome: string;
  nomeFantasia?: string | null;
  temMed?: boolean;
  disponibilidadePixEntrada?: 'TODOS' | 'ESPECIFICOS';
  situacao: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
  permitePixEntrada?: boolean;
  permitePixSaida?: boolean;
};

const SITUACOES: Adquirente['situacao'][] = ['ATIVO', 'INATIVO', 'SUSPENSO'];

export default function AdquirentesPage() {
  const { token, pode } = useAuth();
  const podeCriar = pode(PERMISSOES.ADMIN_ADQUIRENTES_CRIAR);
  const podeEditar = pode(PERMISSOES.ADMIN_ADQUIRENTES_EDITAR);
  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [alternarAberto, setAlternarAberto] = useState(false);
  const [origemAdq, setOrigemAdq] = useState('');
  const [novaAdq, setNovaAdq] = useState('');
  const [cashIn, setCashIn] = useState(true);
  const [cashOut, setCashOut] = useState(false);
  const [resultadoAlt, setResultadoAlt] = useState<string | null>(null);
  const [erroAlt, setErroAlt] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [clientesDe, setClientesDe] = useState<string | null>(null);
  const [novaAberto, setNovaAberto] = useState(false);

  const adquirentes = useQuery({
    queryKey: ['admin-adquirentes'],
    enabled: !!token,
    queryFn: () => api<Adquirente[]>('/admin/provedores', { token: token! }),
  });

  const alternarMassa = useMutation({
    mutationFn: (codigoTotp: string) =>
      api<{ configuracoesUsuarioAtualizadas: number }>(
        '/admin/adquirentes/alternar-massa',
        {
          token: token!,
          method: 'POST',
          body: JSON.stringify({
            adquirenteCodigo: novaAdq,
            origemCodigo: origemAdq || undefined,
            cashIn,
            cashOut,
            codigoTotp,
          }),
        },
      ),
    onSuccess: (r) => {
      setResultadoAlt(
        `Pronto: ${r.configuracoesUsuarioAtualizadas} cliente(s) atualizado(s).`,
      );
      setErroAlt(null);
    },
    onError: (e) => {
      let msg = e instanceof Error ? e.message : 'Falha';
      try {
        const j = JSON.parse(msg) as { message?: unknown };
        if (typeof j.message === 'string') msg = j.message;
      } catch {
        /* texto puro */
      }
      setErroAlt(msg);
      setResultadoAlt(null);
    },
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (adquirentes.data ?? []).filter(
      (a) =>
        (!fSituacao || a.situacao === fSituacao) &&
        (!q ||
          a.nome.toLowerCase().includes(q) ||
          a.codigo.toLowerCase().includes(q)),
    );
  }, [adquirentes.data, busca, fSituacao]);

  const colunas: Coluna<Adquirente>[] = [
    {
      chave: 'nome',
      titulo: 'Adquirente',
      render: (a) => (
        <div>
          <p className="font-medium">{a.nome}</p>
          <p className="font-mono text-xs opacity-60">{a.codigo}</p>
          {a.nomeFantasia && (
            <p className="text-xs opacity-60">Cliente vê: {a.nomeFantasia}</p>
          )}
        </div>
      ),
    },
    {
      chave: 'pix',
      titulo: 'PIX',
      render: (a) =>
        [a.permitePixEntrada && 'Entrada', a.permitePixSaida && 'Saída']
          .filter(Boolean)
          .join(' · ') || '—',
    },
    {
      chave: 'vitrine',
      titulo: 'Vitrine',
      render: (a) => (
        <div className="text-xs">
          <p>
            {a.disponibilidadePixEntrada === 'TODOS'
              ? 'Todos os clientes'
              : 'Clientes liberados'}
          </p>
          <p className="opacity-60">MED: {a.temMed ? 'sim' : 'não'}</p>
        </div>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (a) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            a.situacao === 'ATIVO'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : a.situacao === 'SUSPENSO'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
          }`}
        >
          {a.situacao}
        </span>
      ),
    },
    {
      chave: 'editar',
      titulo: '',
      render: (a) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditando(a.codigo)}
            className="rounded-md border border-ink-800/15 px-3 py-1 text-xs font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            {podeEditar ? 'Editar / taxas' : 'Detalhes'}
          </button>
          <button
            type="button"
            onClick={() => setClientesDe(a.codigo)}
            className="rounded-md border border-ink-800/15 px-3 py-1 text-xs font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Clientes
          </button>
        </div>
      ),
    },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Adquirentes</h1>
          <p className="mt-1 text-sm opacity-70">
            Adquirentes/liquidantes integradas. Adquirente inativa não atualiza
            transações nem saldo (regra de segurança).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeCriar && (
            <button
              type="button"
              onClick={() => setNovaAberto(true)}
              className="rounded-md border border-ink-800/15 px-4 py-2 text-sm font-medium hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              Nova adquirente
            </button>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={() => {
                setResultadoAlt(null);
                setErroAlt(null);
                setOrigemAdq('');
                setNovaAdq('');
                setAlternarAberto(true);
              }}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Alternar em massa
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto label="Buscar" value={busca} onChange={setBusca} placeholder="Nome ou código" />
          <FiltroSelect label="Situação" value={fSituacao} onChange={setFSituacao}>
            <option value="">Todas</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FiltroSelect>
          {(busca || fSituacao) && (
            <BotaoLimparFiltros
              onClick={() => {
                setBusca('');
                setFSituacao('');
              }}
            />
          )}
        </BarraFiltros>

        <TabelaPaginada
          colunas={colunas}
          dados={filtradas}
          chave={(a) => a.codigo}
          carregando={adquirentes.isLoading}
          vazio="Nenhuma adquirente."
          tamanhoPagina={10}
          seletorTamanho
        />
      </div>

      {token && (
        <>
          <EditarAdquirenteModal
            codigo={editando}
            token={token}
            onClose={() => setEditando(null)}
          />
          <ClientesAdquirenteModal
            codigo={clientesDe}
            token={token}
            onClose={() => setClientesDe(null)}
          />
          <NovaAdquirenteModal open={novaAberto} token={token} onClose={() => setNovaAberto(false)} />
        </>
      )}

      <Modal
        open={alternarAberto}
        onClose={() => setAlternarAberto(false)}
        title="Alternar Adquirente"
      >
        {resultadoAlt ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-600">{resultadoAlt}</p>
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
              onClick={() => setAlternarAberto(false)}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const codigoTotp = pedirCodigoTotp();
              if (!codigoTotp) return;
              alternarMassa.mutate(codigoTotp);
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              Adquirente de origem
              <select
                className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900"
                value={origemAdq}
                onChange={(e) => setOrigemAdq(e.target.value)}
              >
                <option value="">Todas (todos os clientes)</option>
                {adquirentes.data?.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nome}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs opacity-60">
                Só os clientes que estão nesta adquirente hoje serão migrados.
              </span>
            </label>

            <label className="block text-sm">
              <TextoRotulo obrigatorio>Adquirente de destino</TextoRotulo>
              <select
                className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900"
                value={novaAdq}
                onChange={(e) => setNovaAdq(e.target.value)}
                required
              >
                <option value="">Selecione uma adquirente</option>
                {adquirentes.data
                  ?.filter((a) => a.situacao === 'ATIVO' && a.codigo !== origemAdq)
                  .map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Selecione quais campos alternar</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cashIn} onChange={(e) => setCashIn(e.target.checked)} />
                Cash In (gateway)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cashOut} onChange={(e) => setCashOut(e.target.checked)} />
                Cash Out (gateway_out)
              </label>
              {!cashIn && !cashOut && (
                <p className="text-xs text-amber-600">Selecione pelo menos uma opção para alternar.</p>
              )}
            </fieldset>

            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {origemAdq ? (
                <>
                  Isto migra os clientes que hoje usam{' '}
                  <strong>
                    {adquirentes.data?.find((a) => a.codigo === origemAdq)?.nome ?? origemAdq}
                  </strong>{' '}
                  para a adquirente de destino, na direção selecionada.
                </>
              ) : (
                <>
                  Isto troca a adquirente de <strong>todos os clientes</strong> de uma vez,
                  para a direção selecionada.
                </>
              )}
            </p>

            {erroAlt && <p className="text-sm text-red-600">{erroAlt}</p>}
            <ModalAcoes
              onCancelar={() => setAlternarAberto(false)}
              rotulo="Confirmar Alternância"
              pendente={alternarMassa.isPending}
              desabilitado={!novaAdq || (!cashIn && !cashOut)}
            />
          </form>
        )}
      </Modal>
    </Shell>
  );
}
