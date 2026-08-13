'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATALOGO_ESCOPOS } from '@/lib/escopos';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import {
  chavePixValida,
  mascararChavePix,
  metaCampoChavePix,
  normalizarChavePixCadastro,
  TIPOS_CHAVE_PIX,
  type TipoChavePix,
} from '@/lib/chave-pix';
import { isCnpj, isCpf, mascaraCnpj, mascaraCpf, normalizarDocumento } from '@/lib/documento';
import { centavosDe, formatarBrl, mensagemValorSaque } from '@/lib/dinheiro';
import { CampoChavePix, CampoMoeda } from './campos';
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

type SaqueModalProps = ModalProps & {
  saldoDisponivel?: string;
  ticketMinimoPixSaida?: string;
  ticketMaximoPixSaida?: string | null;
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
          <CampoMoeda
            label="Valor"
            obrigatorio
            valor={valor}
            onChange={(v) => {
              setValor(v);
              setErro(null);
            }}
            className="!max-w-none"
            dica="Digite só os números — a vírgula entra sozinha."
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes
            onCancelar={fechar}
            rotulo="Gerar cobrança"
            pendente={criar.isPending}
            desabilitado={Number(valor) <= 0}
          />
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

export function SaqueModal({
  open,
  onClose,
  token,
  saldoDisponivel,
  ticketMinimoPixSaida,
  ticketMaximoPixSaida,
}: SaqueModalProps) {
  const { pode } = useAuth();
  const podeRemover = pode(PERMISSOES.CHAVES_PIX_EXCLUIR);
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const [chaveSel, setChaveSel] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [novaChave, setNovaChave] = useState(false);

  // form de cadastro de chave
  const [tipoChave, setTipoChave] = useState<TipoChavePix>('CPF');
  const [chave, setChave] = useState('');
  const [apelido, setApelido] = useState('');
  const [nomeTitular, setNomeTitular] = useState('');
  const [documentoTitular, setDocumentoTitular] = useState('');

  const chaves = useQuery({
    queryKey: ['chaves-pix'],
    enabled: open,
    queryFn: () => api<ChavePix[]>('/painel/chaves-pix', { token }),
  });
  const chaveNormalizada = normalizarChavePixCadastro(tipoChave, chave);
  const chavePronta = chavePixValida(tipoChave, chaveNormalizada);
  const ocorrencias = useQuery({
    queryKey: ['chaves-pix-ocorrencias', tipoChave, chaveNormalizada],
    enabled: open && novaChave && chavePronta,
    queryFn: () =>
      api<{
        outrasContas: Array<{ idPublico: string; nome: string; situacao: string }>;
      }>(
        `/painel/chaves-pix/ocorrencias?tipoChave=${encodeURIComponent(tipoChave)}&chave=${encodeURIComponent(chaveNormalizada)}`,
        { token },
      ),
  });
  const aprovadas = (chaves.data ?? []).filter((c) => c.situacao === 'APROVADA');
  const pendentesOuReprovadas = (chaves.data ?? []).filter(
    (c) => c.situacao !== 'APROVADA',
  );
  const erroValor = mensagemValorSaque({
    valor,
    saldoDisponivel,
    ticketMinimoPixSaida,
    ticketMaximoPixSaida,
  });
  const valorCentavos = centavosDe(valor);
  const valorInvalido =
    !Number.isFinite(valorCentavos) || valorCentavos <= 0 || !!erroValor;

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
          chave: normalizarChavePixCadastro(tipoChave, chave),
          tipoChave,
          nomeTitular: nomeTitular.trim(),
          documentoTitular:
            tipoChave === 'CPF' || tipoChave === 'CNPJ'
              ? normalizarChavePixCadastro(tipoChave, chave)
              : normalizarDocumento(documentoTitular),
          codigoTotp,
        }),
      }),
    onSuccess: () => {
      setNovaChave(false);
      setChave('');
      setApelido('');
      setNomeTitular('');
      setDocumentoTitular('');
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['chaves-pix'] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const remover = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api(`/painel/chaves-pix/${p.id}`, {
        token,
        method: 'DELETE',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: (_r, p) => {
      setErro(null);
      if (chaveSel === p.id) setChaveSel('');
      void qc.invalidateQueries({ queryKey: ['chaves-pix'] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  async function pedirRemocao(id: string) {
    const codigoTotp = await pedirCodigoTotp(
      'Confirme a remoção da chave PIX com o código 2FA. Ela vai para Revogadas.',
    );
    if (!codigoTotp) return;
    remover.mutate({ id, codigoTotp });
  }

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
                if (valorInvalido) return;
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
                      {(c.apelido ? `${c.apelido} — ` : '') +
                        mascararChavePix(c.tipoChave, c.chave)}{' '}
                      ({c.tipoChave})
                    </option>
                  ))}
                </select>
              </label>
              {podeRemover && chaveSel && (
                <button
                  type="button"
                  disabled={remover.isPending}
                  onClick={() => pedirRemocao(chaveSel)}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Remover chave selecionada
                </button>
              )}
              <CampoMoeda
                label="Valor"
                obrigatorio
                valor={valor}
                onChange={(v) => {
                  setValor(v);
                  setErro(null);
                }}
                className="!max-w-none"
                erro={erroValor ?? undefined}
                dica={
                  saldoDisponivel != null && saldoDisponivel !== ''
                    ? `Saldo disponível: ${formatarBrl(saldoDisponivel)}. Digite só os números — a vírgula entra sozinha.`
                    : 'Digite só os números — a vírgula entra sozinha.'
                }
              />
              {erro && !novaChave && (
                <p className="text-sm text-red-600">{erro}</p>
              )}
              <ModalAcoes
                onCancelar={fechar}
                rotulo="Solicitar saque"
                pendente={sacar.isPending || remover.isPending}
                desabilitado={valorInvalido}
              />
            </form>
          ) : (
            <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-3.5 dark:border-amber-400/20 dark:bg-amber-400/[0.08]">
              <KeyRound
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Nenhuma chave aprovada
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-900/70 dark:text-amber-200/70">
                  Cadastre uma chave PIX. O saque libera depois que o
                  administrador aprovar.
                </p>
              </div>
            </div>
          )}

          {pendentesOuReprovadas.length > 0 && (
            <ul className="space-y-2">
              {pendentesOuReprovadas.map((c) => (
                <li
                  key={c.idPublico}
                  className="rounded-xl border border-ink-800/10 bg-ink-800/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm tabular-nums">
                        {mascararChavePix(c.tipoChave, c.chave)}
                      </p>
                      <p className="mt-0.5 text-[11px] opacity-55">
                        {c.apelido ? `${c.apelido} · ` : ''}
                        {c.tipoChave}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <BadgeSituacao situacao={c.situacao} />
                      {podeRemover &&
                        (c.situacao === 'PENDENTE' ||
                          c.situacao === 'REPROVADA') && (
                        <button
                          type="button"
                          disabled={remover.isPending}
                          onClick={() => pedirRemocao(c.idPublico)}
                          className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                  {c.motivoReprovacao && (
                    <p className="mt-2 text-[11px] leading-relaxed text-red-600 dark:text-red-400">
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
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-800/20 px-3 py-2.5 text-sm font-medium text-accent transition hover:border-accent/40 hover:bg-accent/[0.06] dark:border-white/15"
              onClick={() => setNovaChave(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              Cadastrar chave PIX
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (nomeTitular.trim().length < 2) {
                  setErro('Informe o nome do titular da chave.');
                  return;
                }
                const doc =
                  tipoChave === 'CPF' || tipoChave === 'CNPJ'
                    ? normalizarChavePixCadastro(tipoChave, chave)
                    : normalizarDocumento(documentoTitular);
                if (!isCpf(doc) && !isCnpj(doc)) {
                  setErro('Informe o CPF ou CNPJ do titular da chave.');
                  return;
                }
                const codigoTotp = await pedirCodigoTotp(
                  'Confirme o cadastro da chave PIX com o código 2FA (6 dígitos):',
                );
                if (!codigoTotp) return;
                registrar.mutate(codigoTotp);
              }}
              className="space-y-3 rounded-xl border border-ink-800/10 p-3.5 dark:border-white/10"
            >
              <p className="text-sm font-medium">Nova chave PIX</p>
              <label className="block text-sm">
                Tipo
                <select
                  className={inputCls}
                  value={tipoChave}
                  onChange={(e) => {
                    setTipoChave(e.target.value as TipoChavePix);
                    setChave('');
                    setDocumentoTitular('');
                  }}
                >
                  {TIPOS_CHAVE_PIX.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Chave</TextoRotulo>
                <CampoChavePix
                  tipo={tipoChave}
                  valor={chave}
                  onChange={setChave}
                  className={inputCls}
                  required
                />
                <span className="mt-1 block text-[11px] opacity-55">
                  {metaCampoChavePix(tipoChave).dica}
                </span>
              </label>
              {ocorrencias.data && ocorrencias.data.outrasContas.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">
                      Esta chave já está em outra
                      {ocorrencias.data.outrasContas.length > 1 ? 's contas' : ' conta'}{' '}
                      sua
                    </p>
                    <ul className="mt-1 space-y-0.5 opacity-80">
                      {ocorrencias.data.outrasContas.map((o) => (
                        <li key={o.idPublico}>
                          {o.nome} · {o.situacao === 'APROVADA' ? 'aprovada' : 'em análise'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <label className="block text-sm">
                Apelido (opcional)
                <input
                  className={inputCls}
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Nome do titular</TextoRotulo>
                <input
                  className={inputCls}
                  value={nomeTitular}
                  onChange={(e) => setNomeTitular(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Como está no banco"
                />
              </label>
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Documento do titular</TextoRotulo>
                <input
                  className={inputCls}
                  value={
                    tipoChave === 'CPF' || tipoChave === 'CNPJ'
                      ? mascararChavePix(tipoChave, chave)
                      : documentoTitular
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = normalizarDocumento(v);
                    setDocumentoTitular(
                      n.length <= 11 ? mascaraCpf(v) : mascaraCnpj(v),
                    );
                  }}
                  required
                  disabled={tipoChave === 'CPF' || tipoChave === 'CNPJ'}
                  inputMode={tipoChave === 'CNPJ' ? 'text' : 'numeric'}
                  placeholder={
                    tipoChave === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'
                  }
                />
                <span className="mt-1 block text-[11px] opacity-55">
                  {tipoChave === 'CPF' || tipoChave === 'CNPJ'
                    ? 'É a própria chave — a liquidante confere no DICT.'
                    : 'CPF ou CNPJ do dono da chave. A liquidante confere no DICT.'}
                </span>
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
