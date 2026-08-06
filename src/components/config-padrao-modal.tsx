'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  CampoInteiro,
  CampoMoeda,
  CampoPercentual,
  gradeCampos,
  Interruptor,
  Segmentado,
} from '@/components/campos';
import { Modal, ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import {
  BaseCalculoReserva,
  BASES_RESERVA,
  ModoTratamentoMed,
  MODO_TRATAMENTO_MED,
  MODOS_MED,
  prazoEmMeses,
} from '@/lib/config-comercial';

/**
 * Condições comerciais que todo cliente novo recebe na ativação da conta.
 *
 * São exatamente os mesmos campos do cadastro do cliente
 * (`/admin/usuarios/[id]`) — o que se define aqui é o ponto de partida; depois
 * da ativação, cada conta tem a configuração dela e não é mais afetada por
 * mudanças neste padrão.
 */
type ConfigPadrao = {
  taxaPixEntradaPercentual: string;
  taxaPixEntradaFixa: string;
  taxaPixSaidaPercentual: string;
  taxaPixSaidaFixa: string;
  ticketMinimoPixEntrada: string;
  ticketMaximoPixEntrada: string;
  diasLiberacaoSaldo: number;
  percentualReserva: string;
  baseCalculoReserva: BaseCalculoReserva;
  diasRetencaoReserva: number;
  modoTratamentoMed: ModoTratamentoMed;
  permiteSaldoNegativo: boolean;
  origemSaquePermitida: 'PAINEL' | 'API' | 'AMBOS';
  exigirChavePixCadastrada: boolean;
};

const ORIGENS_SAQUE = [
  { v: 'PAINEL', label: 'Painel', dica: 'A API recusa o saque.' },
  { v: 'API', label: 'API', dica: 'Só integração — o painel do lojista recusa.' },
  { v: 'AMBOS', label: 'Painel e API', dica: 'Os dois caminhos liberados.' },
] as const;

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

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink-800/10 p-4 dark:border-white/10">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      {descricao && (
        <p className="mt-0.5 text-[11px] leading-snug opacity-55">{descricao}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ConfigPadraoModal({
  open,
  token,
  podeEditar,
  onClose,
}: {
  open: boolean;
  token: string;
  podeEditar: boolean;
  onClose: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [base, setBase] = useState<BaseCalculoReserva>('VALOR_LIQUIDO_EMPRESA');
  const [modoMed, setModoMed] = useState<ModoTratamentoMed>('BLOQUEAR_SALDO');
  const [origemSaque, setOrigemSaque] = useState<'PAINEL' | 'API' | 'AMBOS'>('PAINEL');
  const [exigirChave, setExigirChave] = useState(true);
  const [saldoNegativo, setSaldoNegativo] = useState(false);
  // Prazo 0 e reserva 0% já significam "desligado" no banco; o interruptor só
  // torna isso explícito, igual ao cadastro do cliente.
  const [liberacaoAtiva, setLiberacaoAtiva] = useState(false);
  const [reservaAtiva, setReservaAtiva] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Débito direto de MED só funciona com a conta podendo ficar negativa. */
  const medExigeNegativo = modoMed === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE;

  const q = useQuery({
    queryKey: ['config-padrao-cliente'],
    enabled: open,
    queryFn: () => api<ConfigPadrao>('/admin/usuarios/config-padrao', { token }),
  });

  useEffect(() => {
    if (!q.data) return;
    setF({
      taxaPixEntradaPercentual: q.data.taxaPixEntradaPercentual,
      taxaPixEntradaFixa: q.data.taxaPixEntradaFixa,
      taxaPixSaidaPercentual: q.data.taxaPixSaidaPercentual,
      taxaPixSaidaFixa: q.data.taxaPixSaidaFixa,
      ticketMinimoPixEntrada: q.data.ticketMinimoPixEntrada,
      ticketMaximoPixEntrada: q.data.ticketMaximoPixEntrada,
      diasLiberacaoSaldo: String(q.data.diasLiberacaoSaldo),
      percentualReserva: q.data.percentualReserva,
      diasRetencaoReserva: String(q.data.diasRetencaoReserva),
    });
    setBase(q.data.baseCalculoReserva);
    setModoMed(
      q.data.modoTratamentoMed === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE
        ? MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE
        : MODO_TRATAMENTO_MED.BLOQUEAR_SALDO,
    );
    setOrigemSaque(q.data.origemSaquePermitida);
    setExigirChave(q.data.exigirChavePixCadastrada);
    setSaldoNegativo(q.data.permiteSaldoNegativo);
    setLiberacaoAtiva(q.data.diasLiberacaoSaldo > 0);
    setReservaAtiva(Number(q.data.percentualReserva) > 0);
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () =>
      api('/admin/usuarios/config-padrao', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          ...f,
          // Desligado grava zero — é assim que o backend entende "não retém".
          diasLiberacaoSaldo: liberacaoAtiva ? campo('diasLiberacaoSaldo') : '0',
          percentualReserva: reservaAtiva ? campo('percentualReserva') : '0',
          diasRetencaoReserva: reservaAtiva ? campo('diasRetencaoReserva') : '0',
          baseCalculoReserva: base,
          modoTratamentoMed: modoMed,
          permiteSaldoNegativo: String(saldoNegativo),
          origemSaquePermitida: origemSaque,
          exigirChavePixCadastrada: String(exigirChave),
        }),
      }),
    onSuccess: () => {
      setErro(null);
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const campo = (k: string) => f[k] ?? '0';

  return (
    <Modal
      open={open}
      onClose={onClose}
      largura="lg"
      title="Padrão de novos clientes"
    >
      {q.isLoading ? (
        <p className="text-sm opacity-60">Carregando…</p>
      ) : q.isError ? (
        <p className="text-sm text-red-600">{erroMsg(q.error)}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
          className="space-y-4"
        >
          <p className="text-xs opacity-60">
            Ponto de partida de toda conta ativada a partir de agora. Cliente já
            ativo não é alterado — para mudar um deles, abra o cadastro dele.
          </p>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Bloco titulo="Taxas" descricao="O que o gateway cobra por operação.">
              <div className={gradeCampos}>
                <CampoPercentual
                  label="Cash-in"
                  valor={campo('taxaPixEntradaPercentual')}
                  onChange={(v) => setF({ ...f, taxaPixEntradaPercentual: v })}
                  disabled={!podeEditar}
                />
                <CampoMoeda
                  label="Cash-in fixo"
                  valor={campo('taxaPixEntradaFixa')}
                  onChange={(v) => setF({ ...f, taxaPixEntradaFixa: v })}
                  disabled={!podeEditar}
                />
                <CampoPercentual
                  label="Cash-out"
                  valor={campo('taxaPixSaidaPercentual')}
                  onChange={(v) => setF({ ...f, taxaPixSaidaPercentual: v })}
                  disabled={!podeEditar}
                />
                <CampoMoeda
                  label="Cash-out fixo"
                  valor={campo('taxaPixSaidaFixa')}
                  onChange={(v) => setF({ ...f, taxaPixSaidaFixa: v })}
                  disabled={!podeEditar}
                />
              </div>
            </Bloco>

            <Bloco
              titulo="Limites de PIX in"
              descricao="Cobrança fora da faixa é recusada na criação."
            >
              <div className={gradeCampos}>
                <CampoMoeda
                  label="Mínimo"
                  valor={campo('ticketMinimoPixEntrada')}
                  onChange={(v) => setF({ ...f, ticketMinimoPixEntrada: v })}
                  disabled={!podeEditar}
                />
                <CampoMoeda
                  label="Máximo"
                  valor={campo('ticketMaximoPixEntrada')}
                  onChange={(v) => setF({ ...f, ticketMaximoPixEntrada: v })}
                  disabled={!podeEditar}
                />
              </div>
            </Bloco>

            <Bloco
              titulo="A liberar (D+)"
              descricao="Segura a venda paga por um prazo antes de virar disponível."
            >
              <Interruptor
                label="Reter por prazo"
                ligado={liberacaoAtiva}
                onChange={(v) => {
                  setLiberacaoAtiva(v);
                  if (v && Number(campo('diasLiberacaoSaldo')) <= 0) {
                    setF({ ...f, diasLiberacaoSaldo: '1' });
                  }
                }}
                disabled={!podeEditar}
              />
              {liberacaoAtiva ? (
                <div className={`mt-3 ${gradeCampos}`}>
                  <CampoInteiro
                    label="Liberar em D+"
                    sufixo="dias"
                    valor={campo('diasLiberacaoSaldo')}
                    onChange={(v) => setF({ ...f, diasLiberacaoSaldo: v })}
                    disabled={!podeEditar}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[11px] opacity-55">
                  Desligado: a venda paga cai direto no disponível e a linha “A
                  liberar” não aparece para o lojista.
                </p>
              )}
            </Bloco>

            <Bloco
              titulo="Reservado"
              descricao="% retido de cada venda como garantia, devolvido depois do prazo."
            >
              <Interruptor
                label="Reter reserva de garantia"
                ligado={reservaAtiva}
                onChange={(v) => {
                  setReservaAtiva(v);
                  if (v && Number(campo('diasRetencaoReserva')) <= 0) {
                    setF({ ...f, diasRetencaoReserva: '30' });
                  }
                }}
                disabled={!podeEditar}
              />
              {reservaAtiva ? (
                <>
                  <div className={`mt-3 ${gradeCampos}`}>
                    <CampoPercentual
                      label="Reserva"
                      valor={campo('percentualReserva')}
                      onChange={(v) => setF({ ...f, percentualReserva: v })}
                      disabled={!podeEditar}
                    />
                    <CampoInteiro
                      label="Manter por"
                      sufixo="dias"
                      valor={campo('diasRetencaoReserva')}
                      onChange={(v) => setF({ ...f, diasRetencaoReserva: v })}
                      disabled={!podeEditar}
                    />
                  </div>
                  <div className="mt-3">
                    <Segmentado
                      label="Calcular sobre"
                      valor={base}
                      opcoes={BASES_RESERVA}
                      onChange={setBase}
                      disabled={!podeEditar}
                    />
                  </div>
                  <p className="mt-2 text-[11px] opacity-55">
                    {Number(campo('percentualReserva')) > 0
                      ? `Retém ${campo('percentualReserva').replace('.', ',')}% por ${prazoEmMeses(campo('diasRetencaoReserva'))}.`
                      : 'Ligada com 0% não retém nada — informe o percentual.'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] opacity-55">
                  Desligada: nada é retido como garantia e a linha “Reservado” não
                  aparece para o lojista.
                </p>
              )}
            </Bloco>

            <Bloco
              titulo="Bloqueado MED"
              descricao="O que acontece quando a adquirente avisa uma contestação."
            >
              <Segmentado
                valor={modoMed}
                opcoes={MODOS_MED}
                onChange={(v) => {
                  setModoMed(v);
                  if (v === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE) {
                    setSaldoNegativo(true);
                  }
                }}
                disabled={!podeEditar}
              />
              {medExigeNegativo && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle
                    className="mt-px h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden
                  />
                  Sem fila de análise: o valor sai do saldo do cliente assim que a
                  contestação chega.
                </p>
              )}
              <div className="mt-3">
                <Interruptor
                  label="Permitir saldo negativo"
                  dica={
                    medExigeNegativo
                      ? 'Obrigatório no débito direto: a contestação precisa sair mesmo sem saldo.'
                      : 'A conta pode ficar devendo quando um MED é debitado. Saque continua exigindo saldo.'
                  }
                  ligado={medExigeNegativo || saldoNegativo}
                  onChange={setSaldoNegativo}
                  disabled={!podeEditar || medExigeNegativo}
                />
              </div>
            </Bloco>

            <Bloco titulo="Saque (cash-out)">
              <div className="space-y-3">
                <Segmentado
                  label="Por onde o cliente pode pedir"
                  valor={origemSaque}
                  opcoes={ORIGENS_SAQUE}
                  onChange={setOrigemSaque}
                  disabled={!podeEditar}
                />
                <Interruptor
                  label="Somente chave PIX cadastrada"
                  dica="Vale para API e painel."
                  ligado={exigirChave}
                  onChange={setExigirChave}
                  disabled={!podeEditar}
                />
              </div>
            </Bloco>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {podeEditar ? (
            <ModalAcoes onCancelar={onClose} pendente={salvar.isPending} />
          ) : (
            <p className="text-sm opacity-60">
              Seu perfil permite consultar, mas não alterar o padrão.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
