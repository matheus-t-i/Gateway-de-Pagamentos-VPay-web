'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { Modal, ModalAcoes } from './modal';
import { TextoRotulo } from './obrigatorio';

const campo =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900';
const rotulo = 'block text-xs font-medium opacity-70';

function erroMsg(e: unknown) {
  let m = e instanceof Error ? e.message : 'Falha';
  try {
    const j = JSON.parse(m) as { message?: unknown };
    if (typeof j.message === 'string') m = j.message;
    else if (Array.isArray(j.message)) m = j.message.join(', ');
  } catch {
    /* texto puro */
  }
  return m;
}

export const TIPOS_CHAVE = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'] as const;

export type Gatilho = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  contaProvedorId: string;
  conta: string;
  adquirente: string;
  adquirenteCodigo: string;
  saldoDisponivel: string | null;
  valorGatilho: string;
  valorReserva: string;
  valorMinimoPayout: string;
  valorMaximoPayout: string | null;
  chavePix: string;
  tipoChavePix: string;
  nomeTitular: string | null;
  documentoTitular: string | null;
  intervaloMinimoMinutos: number;
  ultimaExecucaoEm: string | null;
  criadoEm: string;
};

type Conta = {
  id: string;
  nome: string;
  adquirenteCodigo: string;
  pixSaidaHabilitado: boolean;
};

type Form = {
  contaProvedorId: string;
  nome: string;
  ativo: boolean;
  ordem: string;
  valorGatilho: string;
  valorReserva: string;
  valorMinimoPayout: string;
  valorMaximoPayout: string;
  chavePix: string;
  tipoChavePix: string;
  nomeTitular: string;
  documentoTitular: string;
  intervaloMinimoMinutos: string;
};

const vazio: Form = {
  contaProvedorId: '',
  nome: '',
  ativo: true,
  ordem: '0',
  valorGatilho: '',
  valorReserva: '0',
  valorMinimoPayout: '0',
  valorMaximoPayout: '',
  chavePix: '',
  tipoChavePix: 'ALEATORIA',
  nomeTitular: '',
  documentoTitular: '',
  intervaloMinimoMinutos: '60',
};

/**
 * Cadastro/edição de gatilho de saque automático.
 *
 * `gatilho = null` cria; um gatilho preenche o formulário para edição. A
 * situação (ativo/inativo) só é editável AQUI — na listagem é badge de leitura.
 */
export function GatilhoModal({
  open,
  gatilho,
  token,
  onClose,
}: {
  open: boolean;
  gatilho: Gatilho | null;
  token: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const editando = !!gatilho;

  const contas = useQuery({
    queryKey: ['tesouraria-contas'],
    enabled: open && !editando,
    queryFn: () => api<Conta[]>('/admin/tesouraria/contas', { token }),
  });

  useEffect(() => {
    if (!open) return;
    setErro(null);
    setForm(
      gatilho
        ? {
            contaProvedorId: gatilho.contaProvedorId,
            nome: gatilho.nome,
            ativo: gatilho.ativo,
            ordem: String(gatilho.ordem),
            valorGatilho: gatilho.valorGatilho,
            valorReserva: gatilho.valorReserva,
            valorMinimoPayout: gatilho.valorMinimoPayout,
            valorMaximoPayout: gatilho.valorMaximoPayout ?? '',
            chavePix: gatilho.chavePix,
            tipoChavePix: gatilho.tipoChavePix,
            nomeTitular: gatilho.nomeTitular ?? '',
            documentoTitular: gatilho.documentoTitular ?? '',
            intervaloMinimoMinutos: String(gatilho.intervaloMinimoMinutos),
          }
        : vazio,
    );
  }, [open, gatilho]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = useMutation({
    mutationFn: async (codigoTotp: string) => {
      const corpo = {
        ...form,
        ordem: Number(form.ordem || 0),
        valorGatilho: Number(form.valorGatilho || 0),
        valorReserva: Number(form.valorReserva || 0),
        valorMinimoPayout: Number(form.valorMinimoPayout || 0),
        valorMaximoPayout: form.valorMaximoPayout === '' ? null : Number(form.valorMaximoPayout),
        intervaloMinimoMinutos: Number(form.intervaloMinimoMinutos || 0),
        codigoTotp,
      };
      await api(
        editando ? `/admin/tesouraria/gatilhos/${gatilho!.id}` : '/admin/tesouraria/gatilhos',
        { token, method: editando ? 'PUT' : 'POST', body: JSON.stringify(corpo) },
      );
    },
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['tesouraria-gatilhos'] });
      void qc.invalidateQueries({ queryKey: ['tesouraria-saldos'] });
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar gatilho de saque' : 'Novo gatilho de saque'}
    >
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const codigoTotp = await pedirCodigoTotp();
          if (!codigoTotp) return;
          salvar.mutate(codigoTotp);
        }}
      >
        {!editando && (
          <label className={rotulo}>
            <TextoRotulo obrigatorio>Adquirente / conta</TextoRotulo>
            <select
              className={campo}
              value={form.contaProvedorId}
              onChange={(e) => set('contaProvedorId', e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {contas.data?.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.pixSaidaHabilitado}>
                  {c.nome}
                  {c.pixSaidaHabilitado ? '' : ' (sem PIX de saída)'}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={rotulo}>
          <TextoRotulo obrigatorio>Nome do gatilho</TextoRotulo>
          <input
            className={campo}
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="ex.: Varredura diária"
            required
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={rotulo}>
            <TextoRotulo obrigatorio>Dispara com saldo de (R$)</TextoRotulo>
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0.01"
              value={form.valorGatilho}
              onChange={(e) => set('valorGatilho', e.target.value)}
              required
            />
          </label>
          <label className={rotulo}>
            Reserva — nunca sacar (R$)
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0"
              value={form.valorReserva}
              onChange={(e) => set('valorReserva', e.target.value)}
            />
          </label>
          <label className={rotulo}>
            Saque mínimo (R$)
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0"
              value={form.valorMinimoPayout}
              onChange={(e) => set('valorMinimoPayout', e.target.value)}
            />
          </label>
          <label className={rotulo}>
            Saque máximo (R$) — vazio = sem teto
            <input
              className={campo}
              type="number"
              step="0.01"
              min="0"
              value={form.valorMaximoPayout}
              onChange={(e) => set('valorMaximoPayout', e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={rotulo}>
            Tipo da chave PIX
            <select
              className={campo}
              value={form.tipoChavePix}
              onChange={(e) => set('tipoChavePix', e.target.value)}
            >
              {TIPOS_CHAVE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={rotulo}>
            <TextoRotulo obrigatorio>Chave PIX de destino</TextoRotulo>
            <input
              className={campo}
              value={form.chavePix}
              onChange={(e) => set('chavePix', e.target.value)}
              required
            />
          </label>
          <label className={rotulo}>
            Titular (opcional)
            <input
              className={campo}
              value={form.nomeTitular}
              onChange={(e) => set('nomeTitular', e.target.value)}
            />
          </label>
          <label className={rotulo}>
            Documento do titular (opcional)
            <input
              className={campo}
              value={form.documentoTitular}
              onChange={(e) => set('documentoTitular', e.target.value)}
            />
          </label>
          <label className={rotulo}>
            Intervalo mínimo entre saques (min)
            <input
              className={campo}
              type="number"
              min="0"
              value={form.intervaloMinimoMinutos}
              onChange={(e) => set('intervaloMinimoMinutos', e.target.value)}
            />
          </label>
          <label className={rotulo}>
            Ordem de avaliação
            <input
              className={campo}
              type="number"
              min="0"
              value={form.ordem}
              onChange={(e) => set('ordem', e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => set('ativo', e.target.checked)}
          />
          Gatilho ativo
        </label>

        {erro && (
          <p className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-950/60 dark:text-red-300">
            {erro}
          </p>
        )}

        <ModalAcoes onCancelar={onClose} pendente={salvar.isPending} />
      </form>
    </Modal>
  );
}
