'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { Modal, ModalAcoes } from './modal';

const inputCls =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900';
const btnPrimary =
  'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60';
const btnGhost =
  'rounded-md border border-ink-800/15 px-3 py-1.5 text-sm font-medium transition hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  token: string;
};

type ChavePix = {
  idPublico: string;
  apelido: string | null;
  chave: string;
  tipoChave: string;
  situacao: string;
  motivoReprovacao: string | null;
};
type CobrancaResp = { idTransacao: string; pixCopiaCola?: string | null };
type NovaCredencial = { chavePublica: string; segredo: string };

/** Extrai a mensagem legível do erro lançado por api() (texto ou JSON Nest). */
function mensagemErro(e: unknown): string {
  if (!(e instanceof Error)) return 'Falha na operação';
  try {
    const j = JSON.parse(e.message) as { message?: unknown };
    if (typeof j.message === 'string') return j.message;
  } catch {
    /* texto puro */
  }
  return e.message;
}

/**
 * Botões de Depositar, Sacar e Criar credencial da conta, no dashboard.
 * Só aparecem com a conta ATIVA (regra do backend).
 */
export function ContaAcoes({ ativa }: { ativa: boolean }) {
  const { token, pode } = useAuth();
  const [aberto, setAberto] = useState<null | 'deposito' | 'saque' | 'credencial'>(
    null,
  );

  if (!ativa || !token) {
    return (
      <p className="mt-3 text-xs opacity-60">
        Depósito e saque ficam disponíveis quando a conta estiver ATIVA.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {pode(PERMISSOES.TRANSACOES_CRIAR) && (
        <>
          <button type="button" className={btnGhost} onClick={() => setAberto('deposito')}>
            Depositar
          </button>
          <button type="button" className={btnGhost} onClick={() => setAberto('saque')}>
            Sacar
          </button>
        </>
      )}
      {pode(PERMISSOES.CHAVES_API_CRIAR) && (
        <button type="button" className={btnGhost} onClick={() => setAberto('credencial')}>
          Criar credencial
        </button>
      )}

      <DepositoModal
        open={aberto === 'deposito'}
        onClose={() => setAberto(null)}
        token={token}
      />
      <SaqueModal
        open={aberto === 'saque'}
        onClose={() => setAberto(null)}
        token={token}
      />
      <CredencialModal
        open={aberto === 'credencial'}
        onClose={() => setAberto(null)}
        token={token}
      />
    </div>
  );
}

function DepositoModal({ open, onClose, token }: ModalProps) {
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resp, setResp] = useState<CobrancaResp | null>(null);
  const [copiado, setCopiado] = useState(false);

  const criar = useMutation({
    mutationFn: () =>
      api<CobrancaResp>('/painel/transacoes/cobrancas', {
        token,
        method: 'POST',
        body: JSON.stringify({ valor }),
      }),
    onSuccess: (r) => {
      setResp(r);
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['painel-dashboard'] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function fechar() {
    setValor('');
    setResp(null);
    setErro(null);
    setCopiado(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={fechar} title="Depositar via PIX">
      {!resp ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-sm opacity-70">
            Gere um código PIX copia-e-cola para adicionar saldo. O crédito entra
            quando o pagamento é confirmado.
          </p>
          <label className="block text-sm">
            Valor (R$)
            <input
              className={inputCls}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="100.00"
              inputMode="decimal"
              required
            />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes onCancelar={fechar} rotulo="Gerar cobrança" pendente={criar.isPending} />
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">Pague o código abaixo para creditar o saldo:</p>
          <div className="break-all rounded-md border border-ink-800/15 bg-ink-800/5 p-3 font-mono text-xs dark:border-white/10 dark:bg-white/5">
            {resp.pixCopiaCola ?? '—'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (resp.pixCopiaCola) {
                  void navigator.clipboard.writeText(resp.pixCopiaCola);
                  setCopiado(true);
                }
              }}
            >
              {copiado ? 'Copiado!' : 'Copiar código'}
            </button>
            <button type="button" className="text-sm underline opacity-60" onClick={fechar}>
              Fechar
            </button>
          </div>
          <p className="text-xs opacity-60">Transação: {resp.idTransacao}</p>
        </div>
      )}
    </Modal>
  );
}

export function SaqueModal({ open, onClose, token }: ModalProps) {
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const [chaveSel, setChaveSel] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [novaChave, setNovaChave] = useState(false);

  // form de cadastro de chave
  const [tipoChave, setTipoChave] = useState('CPF');
  const [chave, setChave] = useState('');
  const [apelido, setApelido] = useState('');
  const [nomeTitular, setNomeTitular] = useState('');

  const chaves = useQuery({
    queryKey: ['chaves-pix'],
    enabled: open,
    queryFn: () => api<ChavePix[]>('/painel/chaves-pix', { token }),
  });
  const aprovadas = (chaves.data ?? []).filter((c) => c.situacao === 'APROVADA');
  const pendentesOuReprovadas = (chaves.data ?? []).filter(
    (c) => c.situacao !== 'APROVADA',
  );

  const sacar = useMutation({
    mutationFn: () =>
      api('/painel/transacoes/saques', {
        token,
        method: 'POST',
        body: JSON.stringify({ valor, chavePixIdPublico: chaveSel }),
      }),
    onSuccess: () => {
      setOkMsg('Saque solicitado com sucesso.');
      setErro(null);
      setValor('');
      void qc.invalidateQueries({ queryKey: ['painel-dashboard'] });
    },
    onError: (e) => {
      setErro(mensagemErro(e));
      setOkMsg(null);
    },
  });

  const registrar = useMutation({
    mutationFn: () =>
      api('/painel/chaves-pix', {
        token,
        method: 'POST',
        body: JSON.stringify({
          apelido: apelido || undefined,
          chave,
          tipoChave,
          nomeTitular: nomeTitular || undefined,
        }),
      }),
    onSuccess: () => {
      setNovaChave(false);
      setChave('');
      setApelido('');
      setNomeTitular('');
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['chaves-pix'] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function fechar() {
    setErro(null);
    setOkMsg(null);
    setValor('');
    setNovaChave(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={fechar} title="Sacar via PIX">
      {okMsg ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-600">{okMsg}</p>
          <button type="button" className={btnPrimary} onClick={fechar}>
            Fechar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {aprovadas.length > 0 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sacar.mutate();
              }}
              className="space-y-3"
            >
              <label className="block text-sm">
                Chave PIX aprovada
                <select
                  className={inputCls}
                  value={chaveSel}
                  onChange={(e) => setChaveSel(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {aprovadas.map((c) => (
                    <option key={c.idPublico} value={c.idPublico}>
                      {(c.apelido ? `${c.apelido} — ` : '') + c.chave} ({c.tipoChave})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Valor (R$)
                <input
                  className={inputCls}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="50.00"
                  inputMode="decimal"
                  required
                />
              </label>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <ModalAcoes onCancelar={fechar} rotulo="Solicitar saque" pendente={sacar.isPending} />
            </form>
          ) : (
            <div className="rounded-md border border-dashed border-ink-800/20 p-3 text-sm opacity-80 dark:border-white/20">
              Nenhuma chave PIX aprovada. Cadastre uma chave — o saque libera após a
              aprovação do administrador.
            </div>
          )}

          {pendentesOuReprovadas.length > 0 && (
            <ul className="space-y-1 text-xs">
              {pendentesOuReprovadas.map((c) => (
                <li key={c.idPublico} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.chave}</span>
                  <span className="shrink-0 opacity-60">{c.situacao}</span>
                </li>
              ))}
            </ul>
          )}

          {!novaChave ? (
            <button
              type="button"
              className="text-sm text-accent underline"
              onClick={() => setNovaChave(true)}
            >
              + Cadastrar chave PIX
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                registrar.mutate();
              }}
              className="space-y-3 rounded-md border border-ink-800/10 p-3 dark:border-white/10"
            >
              <p className="text-sm font-medium">Nova chave PIX</p>
              <label className="block text-sm">
                Tipo
                <select
                  className={inputCls}
                  value={tipoChave}
                  onChange={(e) => setTipoChave(e.target.value)}
                >
                  {['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Chave
                <input
                  className={inputCls}
                  value={chave}
                  onChange={(e) => setChave(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                Apelido (opcional)
                <input
                  className={inputCls}
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Nome do titular (opcional)
                <input
                  className={inputCls}
                  value={nomeTitular}
                  onChange={(e) => setNomeTitular(e.target.value)}
                />
              </label>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <ModalAcoes
                onCancelar={() => setNovaChave(false)}
                rotulo="Enviar p/ aprovação"
                pendente={registrar.isPending}
              />
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

function CredencialModal({ open, onClose, token }: ModalProps) {
  const [nome, setNome] = useState('');
  const [ips, setIps] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<NovaCredencial | null>(null);
  const [copiado, setCopiado] = useState(false);

  const criar = useMutation({
    mutationFn: () =>
      api<NovaCredencial>('/painel/credenciais', {
        token,
        method: 'POST',
        body: JSON.stringify({
          nome,
          escopos: [],
          ipsPermitidos: ips
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (r) => {
      setCriada(r);
      setErro(null);
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function fechar() {
    setNome('');
    setIps('');
    setCriada(null);
    setErro(null);
    setCopiado(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={fechar} title="Criar credencial de API">
      {!criada ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            Nome
            <input
              className={inputCls}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: produção loja X"
              required
            />
          </label>
          <label className="block text-sm">
            IPs permitidos (vírgula, vazio = todos)
            <input
              className={inputCls}
              value={ips}
              onChange={(e) => setIps(e.target.value)}
              placeholder="203.0.113.10, 198.51.100.0/24"
            />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes onCancelar={fechar} rotulo="Criar credencial" pendente={criar.isPending} />
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Guarde o segredo — ele não será exibido novamente.
            </p>
            <div className="mt-2 space-y-1 break-all font-mono text-xs">
              <p>
                <span className="opacity-60">x-api-key:</span> {criada.chavePublica}
              </p>
              <p>
                <span className="opacity-60">x-api-secret:</span> {criada.segredo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                void navigator.clipboard.writeText(criada.segredo);
                setCopiado(true);
              }}
            >
              {copiado ? 'Copiado!' : 'Copiar segredo'}
            </button>
            <button type="button" className="text-sm underline opacity-60" onClick={fechar}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
