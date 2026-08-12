'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATALOGO_ESCOPOS } from '@/lib/escopos';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { Modal, ModalAcoes } from './modal';
import { TextoRotulo } from './obrigatorio';
import { QrPix } from './qr-pix';
import { BadgeSituacao } from './status';

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
type CobrancaResp = {
  idTransacao: string;
  pixCopiaCola?: string | null;
  valor?: string;
  situacao?: string;
};
type DetalheTx = { idTransacao: string; situacao: string; valorBruto?: string };
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

export function DepositoModal({ open, onClose, token }: ModalProps) {
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resp, setResp] = useState<CobrancaResp | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Depósito interno não exige step-up 2FA: só gera cobrança PIX para o
  // próprio lojista; o crédito entra quando o pagamento é confirmado.
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

  const status = useQuery({
    queryKey: ['deposito-status', resp?.idTransacao],
    enabled: open && !!resp?.idTransacao,
    refetchInterval: (q) => {
      const s = q.state.data?.situacao;
      if (s === 'CONCLUIDA' || s === 'LIQUIDADA' || s === 'FALHA') return false;
      return 2500;
    },
    queryFn: () =>
      api<DetalheTx>(`/painel/transacoes/${resp!.idTransacao}`, { token }),
  });

  const situacao = status.data?.situacao ?? resp?.situacao ?? 'AGUARDANDO_PAGAMENTO';
  const pago = situacao === 'CONCLUIDA' || situacao === 'LIQUIDADA';
  const falhou = situacao === 'FALHA';

  useEffect(() => {
    if (!pago) return;
    void qc.invalidateQueries({ queryKey: ['painel-dashboard'] });
  }, [pago, qc]);

  function fechar() {
    setValor('');
    setResp(null);
    setErro(null);
    setCopiado(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={fechar} title="Depósito interno via PIX">
      {!resp ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-sm opacity-70">
            Gere um QR Code PIX para adicionar saldo na sua conta. O crédito
            entra quando o pagamento é confirmado.
          </p>
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Valor (R$)</TextoRotulo>
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
      ) : pago ? (
        <div className="space-y-4 text-center">
          <CheckCircle2
            className="mx-auto h-14 w-14 text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-display text-lg font-semibold">PIX recebido</p>
            <p className="text-sm opacity-70">
              O pagamento foi confirmado e o saldo já está sendo creditado na
              sua conta.
            </p>
          </div>
          <BadgeSituacao situacao={situacao} />
          <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={fechar}>
            Fechar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm opacity-70">
              {falhou
                ? 'Não foi possível concluir este PIX.'
                : 'Escaneie o QR ou copie o código para pagar.'}
            </p>
            <BadgeSituacao situacao={situacao} />
          </div>
          {resp.pixCopiaCola && !falhou && <QrPix payload={resp.pixCopiaCola} />}
          {!falhou && (
            <div className="max-h-24 overflow-y-auto break-all rounded-md border border-ink-800/15 bg-ink-800/5 p-3 font-mono text-[11px] leading-relaxed dark:border-white/10 dark:bg-white/5">
              {resp.pixCopiaCola ?? '—'}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!falhou && resp.pixCopiaCola && (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  void navigator.clipboard.writeText(resp.pixCopiaCola!);
                  setCopiado(true);
                }}
              >
                {copiado ? 'Copiado!' : 'Copiar código'}
              </button>
            )}
            <button type="button" className="text-sm underline opacity-60" onClick={fechar}>
              {falhou ? 'Fechar' : 'Pagar depois'}
            </button>
          </div>
          {!falhou && (
            <p className="text-xs opacity-60">
              Aguardando o pagamento… esta tela atualiza sozinha quando o PIX
              for confirmado.
            </p>
          )}
          <p className="text-xs opacity-50">Transação: {resp.idTransacao}</p>
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
    mutationFn: (codigoTotp: string) =>
      api('/painel/transacoes/saques', {
        token,
        method: 'POST',
        body: JSON.stringify({ valor, chavePixIdPublico: chaveSel, codigoTotp }),
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
    mutationFn: (codigoTotp: string) =>
      api('/painel/chaves-pix', {
        token,
        method: 'POST',
        body: JSON.stringify({
          apelido: apelido || undefined,
          chave,
          tipoChave,
          nomeTitular: nomeTitular || undefined,
          codigoTotp,
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
              onSubmit={async (e) => {
                e.preventDefault();
                const codigoTotp = await pedirCodigoTotp(
                  'Confirme o saque com o código 2FA (6 dígitos):',
                );
                if (!codigoTotp) return;
                sacar.mutate(codigoTotp);
              }}
              className="space-y-3"
            >
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Chave PIX aprovada</TextoRotulo>
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
                <TextoRotulo obrigatorio>Valor (R$)</TextoRotulo>
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
            <ul className="space-y-1.5 text-xs">
              {pendentesOuReprovadas.map((c) => (
                <li key={c.idPublico}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.chave}</span>
                    <span className="shrink-0 opacity-60">{c.situacao}</span>
                  </div>
                  {/* Chave reprovada ou desativada pelo admin: sem o motivo aqui,
                      o cliente só veria o status e abriria chamado para perguntar. */}
                  {c.motivoReprovacao && (
                    <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">
                      {c.motivoReprovacao}
                    </p>
                  )}
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
              onSubmit={async (e) => {
                e.preventDefault();
                const codigoTotp = await pedirCodigoTotp(
                  'Confirme o cadastro da chave PIX com o código 2FA (6 dígitos):',
                );
                if (!codigoTotp) return;
                registrar.mutate(codigoTotp);
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
                <TextoRotulo obrigatorio>Chave</TextoRotulo>
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
  const [escopos, setEscopos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<NovaCredencial | null>(null);
  const [copiado, setCopiado] = useState(false);

  const criar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api<NovaCredencial>('/painel/credenciais', {
        token,
        method: 'POST',
        body: JSON.stringify({
          nome,
          escopos,
          ipsPermitidos: ips
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          codigoTotp,
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
          onSubmit={async (e) => {
            e.preventDefault();
            const codigoTotp = await pedirCodigoTotp();
            if (!codigoTotp) return;
            criar.mutate(codigoTotp);
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            <TextoRotulo obrigatorio>Nome</TextoRotulo>
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

          {/* Sem escopo a chave responde 403 em toda rota da API pública. */}
          <div>
            <p className="text-sm">
              <TextoRotulo obrigatorio>Permissões desta chave</TextoRotulo>
            </p>
            <div className="mt-2 space-y-2">
              {CATALOGO_ESCOPOS.map((esc) => (
                <label key={esc.codigo} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={escopos.includes(esc.codigo)}
                    onChange={(e) =>
                      setEscopos(
                        e.target.checked
                          ? [...escopos, esc.codigo]
                          : escopos.filter((c) => c !== esc.codigo),
                      )
                    }
                  />
                  <span>
                    {esc.rotulo}
                    <span className="block text-xs opacity-60">{esc.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes
            onCancelar={fechar}
            rotulo="Criar credencial"
            pendente={criar.isPending}
            desabilitado={!escopos.length}
          />
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
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              O par gera o token de acesso em <code>POST /v1/auth/token</code>; as demais
              rotas usam o token (<code>Authorization: Bearer</code>).
            </p>
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
