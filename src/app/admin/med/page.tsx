'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

type CasoMed = {
  idPublico: string;
  situacao: string;
  modo: string;
  valorSolicitado: string;
  valorBloqueado: string;
  valorDebitado: string;
  valorNaoCoberto: string;
  motivo: string | null;
  recebidoEm: string;
  decididoEm: string | null;
  cliente: { nome: string; idPublico: string };
  transacao: { idTransacao: string; valorBruto: string };
};

type Detalhe = CasoMed & {
  historicos: Array<{
    situacaoAnterior: string | null;
    novaSituacao: string;
    acao: string;
    origem: string;
    motivo: string | null;
    criadoEm: string;
  }>;
  devolucoes: Array<{ idPublico: string; valor: string; situacao: string }>;
};

const FILTROS = ['SALDO_BLOQUEADO', 'EM_ANALISE', 'DEBITADO', 'ACEITO', 'RECUSADO'] as const;

const badge: Record<string, string> = {
  RECEBIDO: 'bg-ink-800/10 dark:bg-white/10',
  SALDO_BLOQUEADO: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  EM_ANALISE: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  DEBITADO: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
  ACEITO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  RECUSADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
};

const rotuloModo: Record<string, string> = {
  BLOQUEAR_SALDO: 'Bloquear saldo',
  DEBITAR_IMEDIATAMENTE: 'Debitar imediatamente',
  ANALISE_MANUAL: 'Análise manual',
};

/** Situações que ainda aceitam decisão do analista. */
const DECIDIVEIS = ['RECEBIDO', 'SALDO_BLOQUEADO', 'DEBITADO', 'EM_ANALISE'];

function Detalhes({ idPublico, token }: { idPublico: string; token: string }) {
  const det = useQuery({
    queryKey: ['med-detalhe', idPublico],
    queryFn: () => api<Detalhe>(`/admin/med/${idPublico}`, { token }),
  });

  if (!det.data) return <p className="text-xs opacity-60">Carregando detalhes…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs opacity-60">Solicitado</p>
          <p className="font-medium">R$ {det.data.valorSolicitado}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Bloqueado</p>
          <p className="font-medium">R$ {det.data.valorBloqueado}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Debitado</p>
          <p className="font-medium">R$ {det.data.valorDebitado}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Não coberto</p>
          <p className="font-medium">R$ {det.data.valorNaoCoberto}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
          Histórico
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          {det.data.historicos.map((h, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 opacity-80">
              <span className="opacity-60">
                {new Date(h.criadoEm).toLocaleString('pt-BR')}
              </span>
              <span>
                {h.situacaoAnterior ? `${h.situacaoAnterior} → ` : ''}
                <strong>{h.novaSituacao}</strong>
              </span>
              <span className="opacity-60">({h.origem})</span>
              {h.motivo && <span className="opacity-70">— {h.motivo}</span>}
            </li>
          ))}
        </ul>
      </div>

      {det.data.devolucoes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
            Devoluções PIX
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {det.data.devolucoes.map((d) => (
              <li key={d.idPublico}>
                R$ {d.valor} · {d.situacao}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function MedPage() {
  const { token, usuario, pode } = useAuth();
  const podeDecidir = pode(PERMISSOES.ADMIN_MED_DECIDIR);
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<string>('SALDO_BLOQUEADO');
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(10);

  // Filtro e paginação client-side voltam ao início quando o recorte muda.
  useEffect(() => {
    setPagina(1);
  }, [situacao, busca]);

  const podeVer =
    usuario?.papeis.includes('ADMINISTRADOR') ||
    usuario?.papeis.includes('ANALISTA_MED');

  const casos = useQuery({
    queryKey: ['med', situacao],
    enabled: !!token && !!podeVer,
    queryFn: () => api<CasoMed[]>(`/admin/med?situacao=${situacao}`, { token: token! }),
  });

  const decidir = useMutation({
    mutationFn: (p: { id: string; decisao: 'ACEITO' | 'RECUSADO'; motivo?: string }) =>
      api(`/admin/med/${p.id}/decidir`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ decisao: p.decisao, motivo: p.motivo }),
      }),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['med'] });
      void qc.invalidateQueries({ queryKey: ['med-detalhe'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha na decisão'),
  });

  if (!podeVer) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold">MED</h1>
        <p className="mt-4 text-sm opacity-70">
          Você não tem permissão para acessar a fila de contestações.
        </p>
      </Shell>
    );
  }

  const termo = busca.trim().toLowerCase();
  const filtrados = (casos.data ?? []).filter((c) => {
    if (!termo) return true;
    return (
      c.idPublico.toLowerCase().includes(termo) ||
      c.cliente.nome.toLowerCase().includes(termo) ||
      c.cliente.idPublico.toLowerCase().includes(termo) ||
      c.transacao.idTransacao.toLowerCase().includes(termo)
    );
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * tamanho;
  const visiveis = filtrados.slice(inicio, inicio + tamanho);

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">MED — Contestações</h1>
      <p className="mt-1 text-sm opacity-70">
        Mecanismo Especial de Devolução: analise as contestações e decida pela
        devolução ao pagador ou pela manutenção do crédito.
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

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="ID do caso, cliente ou transação"
          />
        </BarraFiltros>
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <ul className="mt-6 space-y-3">
        {visiveis.map((c) => (
          <li
            key={c.idPublico}
            className="rounded-lg border border-ink-800/10 p-4 dark:border-white/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  R$ {c.valorSolicitado}{' '}
                  <span className="text-xs font-normal opacity-60">
                    de R$ {c.transacao.valorBruto}
                  </span>
                </p>
                <p className="truncate text-xs opacity-60">
                  {c.cliente.nome}
                </p>
                <p className="truncate font-mono text-xs opacity-50">
                  {c.transacao.idTransacao}
                </p>
                <p className="mt-1 text-xs opacity-60">
                  {rotuloModo[c.modo] ?? c.modo} ·{' '}
                  {new Date(c.recebidoEm).toLocaleString('pt-BR')}
                </p>
                {c.motivo && <p className="mt-1 text-xs opacity-70">{c.motivo}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[c.situacao] ?? ''}`}
                >
                  {c.situacao}
                </span>
                <button
                  type="button"
                  onClick={() => setAberto(aberto === c.idPublico ? null : c.idPublico)}
                  className="text-xs text-accent underline"
                >
                  {aberto === c.idPublico ? 'Fechar' : 'Analisar'}
                </button>
              </div>
            </div>

            {aberto === c.idPublico && token && (
              <div className="mt-4 border-t border-ink-800/10 pt-4 dark:border-white/10">
                <Detalhes idPublico={c.idPublico} token={token} />

                {DECIDIVEIS.includes(c.situacao) && podeDecidir && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decidir.isPending}
                      onClick={() => {
                        const motivo = window.prompt(
                          'Aceitar a contestação devolve o valor ao pagador. Motivo (opcional):',
                        );
                        if (motivo === null) return;
                        decidir.mutate({
                          id: c.idPublico,
                          decisao: 'ACEITO',
                          motivo: motivo.trim() || undefined,
                        });
                      }}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Aceitar (devolver ao pagador)
                    </button>
                    <button
                      type="button"
                      disabled={decidir.isPending}
                      onClick={() => {
                        const motivo = window.prompt(
                          'Recusar mantém o valor com o lojista. Informe o motivo:',
                        );
                        if (!motivo?.trim()) return;
                        decidir.mutate({
                          id: c.idPublico,
                          decisao: 'RECUSADO',
                          motivo: motivo.trim(),
                        });
                      }}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Recusar (manter crédito)
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {casos.data?.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-800/20 p-6 text-center text-sm opacity-70 dark:border-white/20">
            Nenhuma contestação com situação {situacao}.
          </li>
        )}
        {!!casos.data?.length && filtrados.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-800/20 p-6 text-center text-sm opacity-70 dark:border-white/20">
            Nenhum caso corresponde à busca.
          </li>
        )}
      </ul>

      {filtrados.length > 0 && (
        <div className="mt-4 rounded-lg border border-ink-800/10 dark:border-white/10">
          <Paginacao
            pagina={paginaAtual}
            totalPaginas={totalPaginas}
            total={filtrados.length}
            onPagina={setPagina}
            seletor={
              <SeletorPorPagina
                value={tamanho}
                onChange={(novo) => {
                  setTamanho(novo);
                  setPagina(1);
                }}
              />
            }
          />
        </div>
      )}
    </Shell>
  );
}
