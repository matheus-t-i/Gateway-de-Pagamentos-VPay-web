'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal, ModalAcoes } from './modal';

const campo =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900';

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

const SITUACOES = ['ATIVO', 'SUSPENSO', 'BLOQUEADO', 'ENCERRADO'];
const EM_ONBOARDING = (s: string) => s === 'PENDENTE' || s === 'EM_ANALISE';

type Config = {
  temConfig: boolean;
  taxaPixEntradaPercentual: string;
  taxaPixEntradaFixa: string;
  taxaPixSaidaPercentual: string;
  taxaPixSaidaFixa: string;
  diasLiberacaoSaldo: number;
  percentualReserva: string;
  adquirenteEntrada: string | null;
  adquirenteSaida: string | null;
};
type UsuarioAlvo = { idPublico: string; nome: string; situacao: string };

const CAMPOS_TAXA: Array<[string, string]> = [
  ['taxaPixEntradaPercentual', 'Cash-in %'],
  ['taxaPixEntradaFixa', 'Cash-in fixo (R$)'],
  ['taxaPixSaidaPercentual', 'Cash-out %'],
  ['taxaPixSaidaFixa', 'Cash-out fixo (R$)'],
  ['diasLiberacaoSaldo', 'Dias p/ liberar saldo'],
  ['percentualReserva', '% de reserva'],
];

export function EditarUsuarioModal({
  usuario,
  token,
  onClose,
}: {
  usuario: UsuarioAlvo | null;
  token: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState('ATIVO');
  const [f, setF] = useState<Record<string, string>>({});
  const [adqE, setAdqE] = useState('');
  const [adqS, setAdqS] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const cfg = useQuery({
    queryKey: ['usuario-config', usuario?.idPublico],
    enabled: !!usuario,
    queryFn: () => api<Config>(`/admin/usuarios/${usuario!.idPublico}/config`, { token }),
  });
  const adqs = useQuery({
    queryKey: ['adq-lista'],
    enabled: !!usuario,
    queryFn: () =>
      api<Array<{ codigo: string; nome: string; situacao: string }>>('/admin/provedores', {
        token,
      }),
  });

  useEffect(() => {
    if (usuario) setSituacao(usuario.situacao);
  }, [usuario]);
  useEffect(() => {
    if (cfg.data) {
      setF({
        taxaPixEntradaPercentual: cfg.data.taxaPixEntradaPercentual,
        taxaPixEntradaFixa: cfg.data.taxaPixEntradaFixa,
        taxaPixSaidaPercentual: cfg.data.taxaPixSaidaPercentual,
        taxaPixSaidaFixa: cfg.data.taxaPixSaidaFixa,
        diasLiberacaoSaldo: String(cfg.data.diasLiberacaoSaldo),
        percentualReserva: cfg.data.percentualReserva,
      });
      setAdqE(cfg.data.adquirenteEntrada ?? '');
      setAdqS(cfg.data.adquirenteSaida ?? '');
    }
  }, [cfg.data]);

  const onboarding = usuario ? EM_ONBOARDING(usuario.situacao) : false;

  const salvar = useMutation({
    mutationFn: async () => {
      if (usuario && !onboarding && situacao !== usuario.situacao) {
        await api(`/admin/usuarios/${usuario.idPublico}/situacao`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ situacao }),
        });
      }
      await api(`/admin/usuarios/${usuario!.idPublico}/config`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          ...f,
          adquirenteEntrada: adqE || undefined,
          adquirenteSaida: adqS || undefined,
        }),
      });
    },
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['usuarios-gestao'] });
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const ativas = (adqs.data ?? []).filter((a) => a.situacao === 'ATIVO');

  return (
    <Modal open={!!usuario} onClose={onClose} title="Editar usuário">
      {cfg.isLoading ? (
        <p className="text-sm opacity-60">Carregando…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-sm font-medium">{usuario?.nome}</p>

          <label className="block text-sm">
            Situação
            <select
              className={campo}
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              disabled={onboarding}
            >
              {(onboarding ? [usuario!.situacao, ...SITUACOES] : SITUACOES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {onboarding && (
              <span className="mt-1 block text-xs text-amber-600">
                Cadastro em análise — mude o status em Aprovações.
              </span>
            )}
          </label>

          <div>
            <p className="text-sm font-medium">Taxas (o que o gateway cobra)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CAMPOS_TAXA.map(([k, label]) => (
                <label key={k} className="block text-xs">
                  {label}
                  <input
                    className={campo}
                    value={f[k] ?? ''}
                    onChange={(e) => setF({ ...f, [k]: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Adquirente de roteamento</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs">
                Cash-in
                <select className={campo} value={adqE} onChange={(e) => setAdqE(e.target.value)}>
                  <option value="">(manter)</option>
                  {ativas.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Cash-out
                <select className={campo} value={adqS} onChange={(e) => setAdqS(e.target.value)}>
                  <option value="">(manter)</option>
                  {ativas.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes onCancelar={onClose} pendente={salvar.isPending} />
        </form>
      )}
    </Modal>
  );
}
