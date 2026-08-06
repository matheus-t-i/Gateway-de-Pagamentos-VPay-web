'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { CampoInteiro, CampoMoeda, CampoPercentual, Interruptor } from '@/components/campos';
import { ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';

type ContaPerc = {
  id: string;
  nome: string;
  adquirente: string;
  codigoAdquirente: string;
  percentualRetencaoMetodo: number | null;
};

type ConfigRetencao = {
  ativo: boolean;
  textoExcecao: string;
  valorMinimoRetencao: number;
  faturamentoMinimoDia: number;
  offsetMin: number;
  offsetMax: number;
  percentualFallback: number;
  estado: {
    offsetAtual: number;
    dataReferenciaDia: string;
    faturamentoPagoDia: number;
    valorRetidoDia: number;
    diaCivil: string;
  };
  contas: ContaPerc[];
};

function erroMsg(e: unknown) {
  let m = e instanceof Error ? e.message : 'Falha';
  try {
    const j = JSON.parse(m) as { message?: unknown };
    if (typeof j.message === 'string') m = j.message;
  } catch {
    /* texto puro */
  }
  return m;
}

const brl = (v: number) =>
  'R$ ' +
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RetencaoPage() {
  const { token, pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_RETENCAO_EDITAR);
  const qc = useQueryClient();

  const [ativo, setAtivo] = useState(false);
  const [textoExcecao, setTextoExcecao] = useState('teste');
  const [valorMin, setValorMin] = useState('16');
  const [fatMin, setFatMin] = useState('200');
  const [offsetMin, setOffsetMin] = useState('3');
  const [offsetMax, setOffsetMax] = useState('5');
  const [percFallback, setPercFallback] = useState('13');
  const [percContas, setPercContas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cfg = useQuery({
    queryKey: ['retencao-params'],
    enabled: !!token,
    queryFn: () => api<ConfigRetencao>('/admin/retencao', { token: token! }),
  });

  useEffect(() => {
    if (!cfg.data) return;
    setAtivo(cfg.data.ativo);
    setTextoExcecao(cfg.data.textoExcecao);
    setValorMin(String(cfg.data.valorMinimoRetencao));
    setFatMin(String(cfg.data.faturamentoMinimoDia));
    setOffsetMin(String(cfg.data.offsetMin));
    setOffsetMax(String(cfg.data.offsetMax));
    setPercFallback(String(cfg.data.percentualFallback));
    const map: Record<string, string> = {};
    for (const c of cfg.data.contas) {
      map[c.id] =
        c.percentualRetencaoMetodo != null ? String(c.percentualRetencaoMetodo) : '';
    }
    setPercContas(map);
  }, [cfg.data]);

  const salvar = useMutation({
    mutationFn: () =>
      api<ConfigRetencao>('/admin/retencao', {
        token: token!,
        method: 'PUT',
        body: JSON.stringify({
          ativo,
          textoExcecao,
          valorMinimoRetencao: Number(valorMin.replace(',', '.')),
          faturamentoMinimoDia: Number(fatMin.replace(',', '.')),
          offsetMin: Number(offsetMin),
          offsetMax: Number(offsetMax),
          percentualFallback: Number(percFallback.replace(',', '.')),
          contas: (cfg.data?.contas ?? []).map((c) => {
            const raw = (percContas[c.id] ?? '').trim();
            return {
              id: c.id,
              percentualRetencaoMetodo:
                raw === '' ? null : Number(raw.replace(',', '.')),
            };
          }),
        }),
      }),
    onSuccess: () => {
      setErro(null);
      setOk(true);
      void qc.invalidateQueries({ queryKey: ['retencao-params'] });
    },
    onError: (e) => {
      setOk(false);
      setErro(erroMsg(e));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    salvar.mutate();
  };

  const estado = cfg.data?.estado;

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Retenção (método)</h1>
      <p className="mt-1 max-w-2xl text-sm opacity-70">
        Parâmetros globais aplicados quando o PIX é confirmado como pago, antes
        de creditar o saldo. Offset e faturamento do dia são da plataforma
        inteira.
      </p>

      {cfg.isLoading && <p className="mt-6 text-sm opacity-60">Carregando…</p>}

      {cfg.data && (
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          {estado && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Offset atual</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{estado.offsetAtual}</p>
              </div>
              <div className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Dia (SP)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{estado.diaCivil}</p>
              </div>
              <div className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Faturamento pago hoje</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {brl(estado.faturamentoPagoDia)}
                </p>
              </div>
              <div className="rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
                <p className="text-[11px] uppercase tracking-wide opacity-50">Retido hoje</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {brl(estado.valorRetidoDia)}
                </p>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-900 sm:p-5">
            <Interruptor
              label="Método ativo na plataforma"
              dica="Desligado: nenhuma venda é retida."
              ligado={ativo}
              onChange={setAtivo}
              disabled={!podeEditar}
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-medium opacity-70">Texto de exceção</label>
                <input
                  className="mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40"
                  value={textoExcecao}
                  onChange={(e) => setTextoExcecao(e.target.value)}
                  disabled={!podeEditar}
                  maxLength={80}
                />
                <p className="mt-1 text-[11px] opacity-55">
                  Se nome ou e-mail do pagador contiver qualquer um destes
                  termos (separados por vírgula), libera sem reter. Ex.:
                  teste, homolog, dev
                </p>
              </div>
              <CampoMoeda
                label="Valor mínimo para reter"
                valor={valorMin}
                onChange={setValorMin}
                disabled={!podeEditar}
              />
              <CampoMoeda
                label="Faturamento mínimo do dia"
                valor={fatMin}
                onChange={setFatMin}
                disabled={!podeEditar}
              />
              <CampoInteiro
                label="Offset mínimo"
                valor={offsetMin}
                onChange={setOffsetMin}
                disabled={!podeEditar}
              />
              <CampoInteiro
                label="Offset máximo"
                valor={offsetMax}
                onChange={setOffsetMax}
                disabled={!podeEditar}
              />
              <CampoPercentual
                label="% fallback (sem config na conta)"
                valor={percFallback}
                onChange={setPercFallback}
                disabled={!podeEditar}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-900 sm:p-5">
            <h2 className="font-display text-base font-semibold">% por conta de adquirente</h2>
            <p className="mt-0.5 text-xs opacity-60">
              Em branco = usa o fallback. Só contas com PIX in habilitado.
            </p>
            <div className="mt-4 space-y-3">
              {(cfg.data.contas ?? []).map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-ink-800/10 p-3 sm:flex-row sm:items-end sm:justify-between dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.adquirente} · {c.nome}
                    </p>
                    <p className="font-mono text-xs opacity-50">{c.codigoAdquirente}</p>
                  </div>
                  <div className="w-full sm:w-40">
                    <CampoPercentual
                      label="% retenção"
                      valor={percContas[c.id] ?? ''}
                      onChange={(v) => setPercContas((m) => ({ ...m, [c.id]: v }))}
                      disabled={!podeEditar}
                    />
                  </div>
                </div>
              ))}
              {!cfg.data.contas.length && (
                <p className="text-sm opacity-60">Nenhuma conta com PIX in habilitado.</p>
              )}
            </div>
          </section>

          {erro && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {erro}
            </p>
          )}
          {ok && !salvar.isPending && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              Parâmetros salvos.
            </p>
          )}

          {!podeEditar ? (
            <p className="text-sm opacity-60">Seu perfil só permite consultar estes parâmetros.</p>
          ) : (
            <ModalAcoes
              onCancelar={() => {
                void qc.invalidateQueries({ queryKey: ['retencao-params'] });
                setOk(false);
                setErro(null);
              }}
              rotulo="Salvar"
              pendente={salvar.isPending}
            />
          )}
        </form>
      )}
    </Shell>
  );
}
