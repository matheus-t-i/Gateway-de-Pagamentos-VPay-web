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

type Custo = {
  custoPixEntradaPercentual: string;
  custoPixEntradaFixo: string;
  custoPixSaidaPercentual: string;
  custoPixSaidaFixo: string;
};
type Conta = { id: string; nome: string; custo: Custo };
type Situacao = 'ATIVO' | 'INATIVO' | 'SUSPENSO';
type Detalhe = {
  codigo: string;
  nome: string;
  situacao: Situacao;
  permitePixEntrada: boolean;
  permitePixSaida: boolean;
  contas: Conta[];
};

const SITUACOES: Situacao[] = ['ATIVO', 'INATIVO', 'SUSPENSO'];

export function EditarAdquirenteModal({
  codigo,
  token,
  onClose,
}: {
  codigo: string | null;
  token: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('ATIVO');
  const [entrada, setEntrada] = useState(false);
  const [saida, setSaida] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const det = useQuery({
    queryKey: ['adq-det', codigo],
    enabled: !!codigo,
    queryFn: () => api<Detalhe>(`/admin/adquirentes/${codigo}`, { token }),
  });
  useEffect(() => {
    if (det.data) {
      setNome(det.data.nome);
      setSituacao(det.data.situacao);
      setEntrada(det.data.permitePixEntrada);
      setSaida(det.data.permitePixSaida);
      setContas(det.data.contas);
    }
  }, [det.data]);

  const salvar = useMutation({
    mutationFn: async () => {
      await api(`/admin/adquirentes/${codigo}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ nome, permitePixEntrada: entrada, permitePixSaida: saida }),
      });
      if (situacao !== det.data?.situacao) {
        await api(`/admin/provedores/${codigo}/situacao`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ situacao }),
        });
      }
      for (const c of contas) {
        await api(`/admin/adquirentes/contas/${c.id}/custo`, {
          token,
          method: 'PUT',
          body: JSON.stringify(c.custo),
        });
      }
    },
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['admin-adquirentes'] });
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const setCusto = (idx: number, k: keyof Custo, v: string) =>
    setContas((cs) => cs.map((c, i) => (i === idx ? { ...c, custo: { ...c.custo, [k]: v } } : c)));

  return (
    <Modal open={!!codigo} onClose={onClose} title="Editar adquirente">
      {det.isLoading ? (
        <p className="text-sm opacity-60">Carregando…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            Nome
            <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Situação
            <select className={campo} value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao)}>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={entrada} onChange={(e) => setEntrada(e.target.checked)} />
              Permite cash-in
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={saida} onChange={(e) => setSaida(e.target.checked)} />
              Permite cash-out
            </label>
          </div>

          {contas.length === 0 && (
            <p className="rounded-md border border-dashed border-ink-800/20 p-3 text-xs opacity-70 dark:border-white/20">
              Nenhuma conta configurada para esta adquirente.
            </p>
          )}
          {contas.map((c, idx) => (
            <div key={c.id} className="rounded-md border border-ink-800/10 p-3 dark:border-white/10">
              <p className="text-sm font-medium">Custo — {c.nome}</p>
              <p className="text-xs opacity-60">O que a adquirente cobra de nós.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  Cash-in %
                  <input className={campo} value={c.custo.custoPixEntradaPercentual} onChange={(e) => setCusto(idx, 'custoPixEntradaPercentual', e.target.value)} inputMode="decimal" />
                </label>
                <label className="block text-xs">
                  Cash-in fixo (R$)
                  <input className={campo} value={c.custo.custoPixEntradaFixo} onChange={(e) => setCusto(idx, 'custoPixEntradaFixo', e.target.value)} inputMode="decimal" />
                </label>
                <label className="block text-xs">
                  Cash-out %
                  <input className={campo} value={c.custo.custoPixSaidaPercentual} onChange={(e) => setCusto(idx, 'custoPixSaidaPercentual', e.target.value)} inputMode="decimal" />
                </label>
                <label className="block text-xs">
                  Cash-out fixo (R$)
                  <input className={campo} value={c.custo.custoPixSaidaFixo} onChange={(e) => setCusto(idx, 'custoPixSaidaFixo', e.target.value)} inputMode="decimal" />
                </label>
              </div>
            </div>
          ))}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes onCancelar={onClose} pendente={salvar.isPending} />
        </form>
      )}
    </Modal>
  );
}

const CAMPOS_TAXA: Array<[string, string]> = [
  ['taxaPixEntradaPercentual', 'Cash-in %'],
  ['taxaPixEntradaFixa', 'Cash-in fixo (R$)'],
  ['taxaPixSaidaPercentual', 'Cash-out %'],
  ['taxaPixSaidaFixa', 'Cash-out fixo (R$)'],
  ['ticketMinimoPixEntrada', 'Ticket mínimo cash-in'],
  ['ticketMaximoPixEntrada', 'Ticket máximo cash-in'],
  ['diasLiberacaoSaldo', 'Dias p/ liberar saldo'],
  ['percentualReserva', '% de reserva'],
  ['diasRetencaoReserva', 'Dias retenção reserva'],
];

export function TaxaPadraoModal({
  open,
  token,
  onClose,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['taxa-padrao'],
    enabled: open,
    queryFn: () => api<Record<string, string | number>>('/admin/taxa-padrao', { token }),
  });
  useEffect(() => {
    if (q.data) {
      const o: Record<string, string> = {};
      Object.entries(q.data).forEach(([k, v]) => (o[k] = String(v)));
      setF(o);
    }
  }, [q.data]);
  const salvar = useMutation({
    mutationFn: () => api('/admin/taxa-padrao', { token, method: 'PUT', body: JSON.stringify(f) }),
    onSuccess: () => {
      setErro(null);
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Taxas padrão do sistema">
      {q.isLoading ? (
        <p className="text-sm opacity-60">Carregando…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
          className="space-y-3"
        >
          <p className="text-xs opacity-60">O que o gateway cobra dos lojistas por padrão.</p>
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS_TAXA.map(([k, label]) => (
              <label key={k} className="block text-xs">
                {label}
                <input className={campo} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode="decimal" />
              </label>
            ))}
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes onCancelar={onClose} pendente={salvar.isPending} />
        </form>
      )}
    </Modal>
  );
}

export function NovaAdquirenteModal({
  open,
  token,
  onClose,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [entrada, setEntrada] = useState(true);
  const [saida, setSaida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criar = useMutation({
    mutationFn: () =>
      api('/admin/adquirentes', {
        token,
        method: 'POST',
        body: JSON.stringify({ codigo, nome, permitePixEntrada: entrada, permitePixSaida: saida }),
      }),
    onSuccess: () => {
      setErro(null);
      setCodigo('');
      setNome('');
      void qc.invalidateQueries({ queryKey: ['admin-adquirentes'] });
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Nova adquirente">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          criar.mutate();
        }}
        className="space-y-4"
      >
        <label className="block text-sm">
          Código
          <input className={campo} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: sparc" required />
        </label>
        <label className="block text-sm">
          Nome
          <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={entrada} onChange={(e) => setEntrada(e.target.checked)} /> Cash-in
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={saida} onChange={(e) => setSaida(e.target.checked)} /> Cash-out
          </label>
        </div>
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Nasce INATIVA. Configure a conta/credenciais e ative depois.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <ModalAcoes onCancelar={onClose} rotulo="Cadastrar" pendente={criar.isPending} />
      </form>
    </Modal>
  );
}
