'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import {
  CampoInteiro,
  CampoMoeda,
  CampoPercentual,
  Interruptor,
} from '@/components/campos';
import { ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type Config = {
  ativo: boolean;
  offsetMin: number;
  offsetMax: number;
  toleranciaValor: number;
  contencaoAtiva: boolean;
  percentualContencaoDia: number;
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

export default function MedAutomaticoPage() {
  const { token, pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_MED_AUTOMATICO_EDITAR);
  const qc = useQueryClient();

  const [ativo, setAtivo] = useState(false);
  const [offsetMin, setOffsetMin] = useState('3');
  const [offsetMax, setOffsetMax] = useState('5');
  const [tolerancia, setTolerancia] = useState('50');
  const [contencaoAtiva, setContencaoAtiva] = useState(false);
  const [percContencao, setPercContencao] = useState('0');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cfg = useQuery({
    queryKey: ['med-auto-params'],
    enabled: !!token,
    queryFn: () => api<Config>('/admin/med-automatico', { token: token! }),
  });

  useEffect(() => {
    if (!cfg.data) return;
    setAtivo(cfg.data.ativo);
    setOffsetMin(String(cfg.data.offsetMin));
    setOffsetMax(String(cfg.data.offsetMax));
    setTolerancia(String(cfg.data.toleranciaValor));
    setContencaoAtiva(cfg.data.contencaoAtiva);
    setPercContencao(String(cfg.data.percentualContencaoDia));
  }, [cfg.data]);

  const salvar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api<Config>('/admin/med-automatico', {
        token: token!,
        method: 'PUT',
        body: JSON.stringify({
          ativo,
          offsetMin: Number(offsetMin),
          offsetMax: Number(offsetMax),
          toleranciaValor: Number(tolerancia.replace(',', '.')),
          contencaoAtiva,
          percentualContencaoDia: Number(percContencao.replace(',', '.')),
          codigoTotp,
        }),
      }),
    onSuccess: () => {
      setErro(null);
      setOk(true);
      void qc.invalidateQueries({ queryKey: ['med-auto-params'] });
    },
    onError: (e) => {
      setOk(false);
      setErro(erroMsg(e));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const codigoTotp = pedirCodigoTotp();
    if (!codigoTotp) return;
    salvar.mutate(codigoTotp);
  };

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">MED automático</h1>
      <p className="mt-1 max-w-2xl text-sm opacity-70">
        Depois que uma venda é creditada, pode converter uma venda paga de
        ontem em MED (simulado localmente), até o % configurado no cliente.
        Offset e acumuladores são por cliente.
      </p>

      {cfg.isLoading && <p className="mt-6 text-sm opacity-60">Carregando…</p>}

      {cfg.data && (
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <section className="rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-900 sm:p-5">
            <Interruptor
              label="MED automático ativo na plataforma"
              dica="Desligado: nenhum cliente dispara conversão automática."
              ligado={ativo}
              onChange={setAtivo}
              disabled={!podeEditar}
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <CampoMoeda
                label="Tolerância (±)"
                dica="Faixa em torno do valor que ainda falta aplicar."
                valor={tolerancia}
                onChange={setTolerancia}
                disabled={!podeEditar}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-ink-800/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-ink-900 sm:p-5">
            <Interruptor
              label="Contenção de MED"
              dica="Se o % de MED auto do dia do cliente já está no teto, não aplica."
              ligado={contencaoAtiva}
              onChange={setContencaoAtiva}
              disabled={!podeEditar}
            />
            {contencaoAtiva && (
              <div className="mt-4 max-w-xs">
                <CampoPercentual
                  label="% teto de contenção (sobre fat. de ontem)"
                  valor={percContencao}
                  onChange={setPercContencao}
                  disabled={!podeEditar}
                />
              </div>
            )}
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
            <p className="text-sm opacity-60">Seu perfil só permite consultar.</p>
          ) : (
            <ModalAcoes
              onCancelar={() => {
                void qc.invalidateQueries({ queryKey: ['med-auto-params'] });
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
