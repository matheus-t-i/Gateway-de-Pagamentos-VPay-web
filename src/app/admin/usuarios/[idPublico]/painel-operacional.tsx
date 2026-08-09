'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  KeyRound,
  Network,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CampoInteiro,
  CampoMoeda,
  CampoPercentual,
  Interruptor,
  Segmentado,
  Selecao,
} from '@/components/campos';
import { ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  BaseCalculoReserva,
  BASES_RESERVA,
  ModoTratamentoMed,
  MODO_TRATAMENTO_MED,
  MODOS_MED,
  prazoEmMeses,
} from '@/lib/config-comercial';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

export const campo =
  'mt-1 w-full rounded-lg border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-950/40';

export type Config = {
  temConfig: boolean;
  taxaPixEntradaPercentual: string;
  taxaPixEntradaFixa: string;
  taxaPixSaidaPercentual: string;
  taxaPixSaidaFixa: string;
  diasLiberacaoSaldo: number;
  percentualReserva: string;
  baseCalculoReserva: BaseCalculoReserva;
  diasRetencaoReserva: number;
  modoTratamentoMed: ModoTratamentoMed;
  permiteSaldoNegativo: boolean;
  ticketMinimoPixEntrada: string;
  ticketMaximoPixEntrada: string;
  ticketMinimoPixSaida: string;
  ticketMaximoPixSaida: string;
  origemSaquePermitida: 'PAINEL' | 'API' | 'AMBOS';
  exigirChavePixCadastrada: boolean;
  retencaoMetodoAtivo: boolean;
  percentualRetencaoMetodo: string;
  medAutomaticoAtivo: boolean;
  percentualMedAutomatico: string;
  adquirenteEntrada: string | null;
  adquirenteSaida: string | null;
};

const SITUACOES_EDITAVEIS = ['ATIVO', 'SUSPENSO', 'BLOQUEADO', 'ENCERRADO'];
const EM_ONBOARDING = (s: string) => s === 'PENDENTE' || s === 'EM_ANALISE';

const ORIGENS_SAQUE = [
  { v: 'PAINEL', label: 'Painel', dica: 'Padrão do sistema — a API recusa o saque.' },
  { v: 'API', label: 'API', dica: 'Só integração — o painel do lojista recusa.' },
  { v: 'AMBOS', label: 'Painel e API', dica: 'Os dois caminhos liberados.' },
] as const;

export function erroMsg(e: unknown) {
  let m = e instanceof Error ? e.message : 'Falha';
  try {
    const j = JSON.parse(m) as { message?: unknown };
    if (typeof j.message === 'string') m = j.message;
  } catch {
    /* texto puro */
  }
  return m;
}

/** Cabeçalho padrão dos blocos operacionais. */
export function Bloco({
  icone: Icone,
  titulo,
  descricao,
  acessorio,
  children,
  perigo = false,
  className = '',
}: {
  icone: React.ElementType;
  titulo: string;
  descricao?: string;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
  perigo?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm dark:bg-ink-900 ${
        perigo
          ? 'border-amber-500/30'
          : 'border-ink-800/10 dark:border-white/10'
      } ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-800/[0.07] px-3 py-3 sm:px-4 dark:border-white/[0.07]">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              perigo
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-accent/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Icone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold leading-tight sm:text-base">
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-0.5 text-[11px] leading-snug opacity-60 sm:text-xs">
                {descricao}
              </p>
            )}
          </div>
        </div>
        {acessorio && <div className="flex shrink-0 items-center gap-2">{acessorio}</div>}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

/**
 * Cartão full-width — a densidade vem da grade interna multi-coluna que
 * preenche a largura útil (estilo formulário admin denso).
 */
function Grupo({
  titulo,
  descricao,
  children,
  className = '',
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 w-full rounded-xl border border-ink-800/10 p-3 dark:border-white/10 ${className}`}
    >
      <h3 className="text-sm font-semibold leading-tight">{titulo}</h3>
      {descricao && (
        <p className="mt-0.5 text-[11px] leading-snug opacity-55">{descricao}</p>
      )}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Título de seção empilhado — sem coluna lateral. */
function Faixa({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <div className="mb-2">
        <h3 className="text-sm font-semibold leading-tight">{titulo}</h3>
        {descricao && (
          <p className="mt-0.5 text-[11px] leading-snug opacity-50">{descricao}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Coluna interna densa (sem borda própria) dentro de um único card. */
function Coluna({
  titulo,
  children,
  className = '',
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide leading-tight opacity-60">
        {titulo}
      </h4>
      {children}
    </div>
  );
}

/**
 * Campo preenche a célula da grade (sobrescreve o teto global de 11rem).
 * Sem isso, a linha fica com buracos mesmo em grid full-width.
 */
const celula = '!max-w-none';

/** Grade horizontal que usa a largura do card — mobile empilha, desktop multi-coluna. */
const gradeLinha =
  'grid grid-cols-1 gap-x-2.5 gap-y-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9';

/** Grade das retenções + saque + ferramentas internas (7 colunas no desktop largo). */
const gradeRetencoes =
  'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7';

/** Aviso curto em âmbar — regra ligada que ainda não faz nada. */
function Atencao({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1 text-[10px] leading-snug text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </p>
  );
}

/**
 * Condições comerciais e limites — o que o administrador realmente altera nesta
 * tela. Perfis de acesso NÃO ficam aqui: são atribuídos em `/admin/perfis`,
 * onde a permissão exigida é a de perfis e não a de gestão de contas.
 */
export function FormularioOperacao({
  idPublico,
  situacaoAtual,
  token,
  onSalvo,
}: {
  idPublico: string;
  situacaoAtual: string;
  token: string;
  onSalvo: () => void;
}) {
  const { pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_USUARIOS_EDITAR);
  const [situacao, setSituacao] = useState(situacaoAtual);
  const [f, setF] = useState<Record<string, string>>({});
  const [maxEntrada, setMaxEntrada] = useState('');
  const [minEntrada, setMinEntrada] = useState('');
  const [maxSaida, setMaxSaida] = useState('');
  const [minSaida, setMinSaida] = useState('');
  const [origemSaque, setOrigemSaque] = useState<'PAINEL' | 'API' | 'AMBOS'>('PAINEL');
  const [exigirChave, setExigirChave] = useState(true);
  const [baseReserva, setBaseReserva] = useState<BaseCalculoReserva>(
    'VALOR_LIQUIDO_EMPRESA',
  );
  const [modoMed, setModoMed] = useState<ModoTratamentoMed>('BLOQUEAR_SALDO');
  const [saldoNegativo, setSaldoNegativo] = useState(false);
  // Liga/desliga de "A liberar" e "Reservado". No banco não existe flag: prazo 0
  // e reserva 0% JÁ significam desligado. O interruptor é o que torna isso
  // visível — e é ele que decide se a linha aparece no painel do lojista.
  const [liberacaoAtiva, setLiberacaoAtiva] = useState(false);
  const [reservaAtiva, setReservaAtiva] = useState(false);
  const [retencaoAtiva, setRetencaoAtiva] = useState(false);
  const [percRetencao, setPercRetencao] = useState('0');
  const [medAutoAtivo, setMedAutoAtivo] = useState(false);
  const [percMedAuto, setPercMedAuto] = useState('0');
  const [adqE, setAdqE] = useState('');
  const [adqS, setAdqS] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cfg = useQuery({
    queryKey: ['usuario-config', idPublico],
    queryFn: () => api<Config>(`/admin/usuarios/${idPublico}/config`, { token }),
  });
  const adqs = useQuery({
    queryKey: ['adq-lista'],
    queryFn: () =>
      api<Array<{ codigo: string; nome: string; situacao: string }>>(
        '/admin/provedores',
        { token },
      ),
  });

  useEffect(() => setSituacao(situacaoAtual), [situacaoAtual]);
  useEffect(() => {
    if (!cfg.data) return;
    setF({
      taxaPixEntradaPercentual: cfg.data.taxaPixEntradaPercentual,
      taxaPixEntradaFixa: cfg.data.taxaPixEntradaFixa,
      taxaPixSaidaPercentual: cfg.data.taxaPixSaidaPercentual,
      taxaPixSaidaFixa: cfg.data.taxaPixSaidaFixa,
      diasLiberacaoSaldo: String(cfg.data.diasLiberacaoSaldo),
      percentualReserva: cfg.data.percentualReserva,
      diasRetencaoReserva: String(cfg.data.diasRetencaoReserva),
    });
    setMinEntrada(cfg.data.ticketMinimoPixEntrada);
    setMaxEntrada(cfg.data.ticketMaximoPixEntrada);
    setMinSaida(cfg.data.ticketMinimoPixSaida);
    setMaxSaida(cfg.data.ticketMaximoPixSaida || '');
    setOrigemSaque(cfg.data.origemSaquePermitida);
    setExigirChave(cfg.data.exigirChavePixCadastrada);
    setBaseReserva(cfg.data.baseCalculoReserva);
    setModoMed(
      cfg.data.modoTratamentoMed === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE
        ? MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE
        : MODO_TRATAMENTO_MED.BLOQUEAR_SALDO,
    );
    setSaldoNegativo(cfg.data.permiteSaldoNegativo);
    setLiberacaoAtiva(cfg.data.diasLiberacaoSaldo > 0);
    setReservaAtiva(Number(cfg.data.percentualReserva) > 0);
    setRetencaoAtiva(cfg.data.retencaoMetodoAtivo);
    setPercRetencao(cfg.data.percentualRetencaoMetodo);
    setMedAutoAtivo(cfg.data.medAutomaticoAtivo);
    setPercMedAuto(cfg.data.percentualMedAutomatico);
    setAdqE(cfg.data.adquirenteEntrada ?? '');
    setAdqS(cfg.data.adquirenteSaida ?? '');
  }, [cfg.data]);

  const onboarding = EM_ONBOARDING(situacaoAtual);

  const salvar = useMutation({
    mutationFn: async (codigoTotp: string) => {
      if (!onboarding && situacao !== situacaoAtual) {
        await api(`/admin/usuarios/${idPublico}/situacao`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ situacao, codigoTotp }),
        });
      }
      await api(`/admin/usuarios/${idPublico}/config`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          ...f,
          // Desligado grava zero: é assim que o backend já entende "não retém".
          diasLiberacaoSaldo: liberacaoAtiva ? (f.diasLiberacaoSaldo ?? '0') : '0',
          percentualReserva: reservaAtiva ? (f.percentualReserva ?? '0') : '0',
          diasRetencaoReserva: reservaAtiva ? (f.diasRetencaoReserva ?? '0') : '0',
          ticketMinimoPixEntrada: minEntrada,
          ticketMaximoPixEntrada: maxEntrada,
          ticketMinimoPixSaida: minSaida,
          // Zero ou vazio = sem teto (coluna nullable na API).
          ticketMaximoPixSaida:
            !maxSaida || Number(maxSaida) === 0 ? '' : maxSaida,
          origemSaquePermitida: origemSaque,
          exigirChavePixCadastrada: String(exigirChave),
          baseCalculoReserva: baseReserva,
          modoTratamentoMed: modoMed,
          // A API força `true` no débito direto — mandar o estado da tela é só
          // para o modo em que o admin realmente escolhe.
          permiteSaldoNegativo: String(saldoNegativo),
          retencaoMetodoAtivo: String(retencaoAtiva),
          percentualRetencaoMetodo: percRetencao,
          medAutomaticoAtivo: String(medAutoAtivo),
          percentualMedAutomatico: percMedAuto,
          adquirenteEntrada: adqE || undefined,
          adquirenteSaida: adqS || undefined,
          codigoTotp,
        }),
      });
    },
    onSuccess: () => {
      setErro(null);
      setOk(true);
      onSalvo();
    },
    onError: (e) => {
      setOk(false);
      setErro(erroMsg(e));
    },
  });

  if (cfg.isLoading) return <p className="text-sm opacity-60">Carregando…</p>;
  const ativas = (adqs.data ?? []).filter((a) => a.situacao === 'ATIVO');
  /** Débito direto de MED só funciona com a conta podendo ficar negativa. */
  const medExigeNegativo = modoMed === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const codigoTotp = pedirCodigoTotp();
        if (!codigoTotp) return;
        salvar.mutate(codigoTotp);
      }}
      className="space-y-3"
    >
      <div className="divide-y divide-ink-800/[0.07] dark:divide-white/[0.07]">
      <Faixa
        titulo="Conta e taxas"
        descricao="Situação, limites Pix-IN/OUT e taxas na mesma linha."
      >
        <Grupo titulo="Conta, limites e taxas">
          <div className={gradeLinha}>
            <Selecao
              label="Situação da Conta"
              ajuda="Define se a conta opera normalmente (ATIVO), fica suspensa, bloqueada ou encerrada. Em PENDENTE/EM_ANALISE a troca não é feita aqui — use Aprovações. Afeta login (só ATIVO emite JWT), criação de cobrança e elegibilidade de saque."
              value={situacao}
              onChange={setSituacao}
              disabled={onboarding || !podeEditar}
              className={celula}
            >
              {(onboarding
                ? [situacaoAtual, ...SITUACOES_EDITAVEIS]
                : SITUACOES_EDITAVEIS
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Selecao>
            <CampoMoeda
              label="Valor mínimo de Pix-IN"
              ajuda="Menor valor aceito ao criar cobrança PIX (API e painel). Cobrança abaixo disso é recusada na criação — não chega à adquirente. Comparado com ticketMinimoPixEntrada da config efetiva."
              valor={minEntrada}
              onChange={setMinEntrada}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoMoeda
              label="Valor máximo de Pix-IN"
              ajuda="Teto de valor por cobrança PIX in. Acima disso a criação é recusada. Precisa ser maior que zero e ≥ ao mínimo. Grava em ticketMaximoPixEntrada."
              valor={maxEntrada}
              onChange={setMaxEntrada}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoMoeda
              label="Valor mínimo de Pix-OUT"
              ajuda="Menor valor de saque (cash-out) permitido — painel e API. Abaixo disso o saque é recusado antes do débito no ledger e antes de ir à liquidante (ticketMinimoPixSaida)."
              valor={minSaida}
              onChange={setMinSaida}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoMoeda
              label="Valor máximo de Pix-OUT"
              ajuda="Teto de saque. Zero (ou vazio) = sem teto (coluna nullable). Qualquer valor > 0 limita o saque; acima disso a operação é recusada (ticketMaximoPixSaida)."
              valor={maxSaida || '0'}
              onChange={setMaxSaida}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoPercentual
              label="Taxa Cash-IN (%)"
              ajuda="Percentual cobrado do cliente em cada PIX in pago. Entra no cálculo do líquido creditado no ledger e no valor exibido no callback (deposito_liquido). Não muda ao trocar de adquirente — a taxa é do cliente."
              valor={f.taxaPixEntradaPercentual ?? ''}
              onChange={(v) => setF({ ...f, taxaPixEntradaPercentual: v })}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoMoeda
              label="Taxa Fixa Cash-IN (R$)"
              ajuda="Valor fixo somado à taxa % em cada cash-in. Também reduz o líquido creditado. Pode ser zero. Persistido em taxaPixEntradaFixa."
              valor={f.taxaPixEntradaFixa ?? '0'}
              onChange={(v) => setF({ ...f, taxaPixEntradaFixa: v })}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoPercentual
              label="Taxa Cash-OUT (%)"
              ajuda="Percentual cobrado em cada saque. O débito no ledger já contempla a taxa antes do envio à liquidante. Afeta o valor líquido que sai da conta do lojista."
              valor={f.taxaPixSaidaPercentual ?? ''}
              onChange={(v) => setF({ ...f, taxaPixSaidaPercentual: v })}
              disabled={!podeEditar}
              className={celula}
            />
            <CampoMoeda
              label="Taxa Fixa Cash-OUT (R$)"
              ajuda="Parcela fixa da taxa de saque, somada ao %. Pode ser zero. Grava em taxaPixSaidaFixa."
              valor={f.taxaPixSaidaFixa ?? '0'}
              onChange={(v) => setF({ ...f, taxaPixSaidaFixa: v })}
              disabled={!podeEditar}
              className={celula}
            />
          </div>
          {onboarding && (
            <p className="mt-2 text-[11px] text-amber-600">
              Em análise — decida em{' '}
              <Link href="/admin/aprovacoes" className="underline">
                Aprovações
              </Link>
              .
            </p>
          )}
          {cfg.data && !cfg.data.temConfig && (
            <p className="mt-1.5 text-[10px] opacity-55">
              Usa o padrão do sistema — salvar cria config própria desta conta.
            </p>
          )}
        </Grupo>
      </Faixa>

      <Faixa
        titulo="Retenções e saque"
        descricao="Saldo parado, MED, cash-out, adquirente e ferramentas de simulação."
      >
        <Grupo titulo="Retenções, saque e roteamento">
          <div className={gradeRetencoes}>
            <Coluna titulo="A liberar (D+)">
              <Interruptor
                label="Reter por prazo"
                ajuda="Ligado: venda paga fica em PENDENTE_LIBERACAO por D+N dias antes de virar disponível — aparece como “A liberar” no painel do lojista. Desligado grava dias=0: o valor cai direto no disponível e a linha some do dashboard (salvo saldo ainda preso)."
                ligado={liberacaoAtiva}
                onChange={(v) => {
                  setLiberacaoAtiva(v);
                  if (v && Number(f.diasLiberacaoSaldo ?? 0) <= 0) {
                    setF({ ...f, diasLiberacaoSaldo: '1' });
                  }
                }}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {liberacaoAtiva ? (
                <>
                  <CampoInteiro
                    label="Liberar em D+"
                    sufixo="dias"
                    ajuda="Prazo em dias após o pagamento para liberar o saldo. D+0 com interruptor ligado não retém nada — informe ≥1. A fila 6-liberacao-saldo move PENDENTE_LIBERACAO → DISPONIVEL."
                    valor={f.diasLiberacaoSaldo ?? '0'}
                    onChange={(v) => setF({ ...f, diasLiberacaoSaldo: v })}
                    disabled={!podeEditar}
                    className={celula}
                  />
                  {Number(f.diasLiberacaoSaldo ?? 0) > 0 ? (
                    <p className="text-[10px] opacity-55">
                      Disponível em D+{Number(f.diasLiberacaoSaldo)}.
                    </p>
                  ) : (
                    <Atencao>Informe o prazo (0 dia não retém).</Atencao>
                  )}
                </>
              ) : (
                <p className="text-[10px] opacity-55">Desligado: cai no disponível.</p>
              )}
            </Coluna>

            <Coluna titulo="Reservado">
              <Interruptor
                label="Reter reserva"
                ajuda="Ligado: retém um % de cada venda como garantia (bucket RESERVADO no ledger) e devolve após o prazo. Desligado grava 0% — a linha “Reservado” some do painel do lojista, salvo saldo ainda preso."
                ligado={reservaAtiva}
                onChange={(v) => {
                  setReservaAtiva(v);
                  if (v && Number(f.diasRetencaoReserva ?? 0) <= 0) {
                    setF({ ...f, diasRetencaoReserva: '30' });
                  }
                }}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {reservaAtiva ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoPercentual
                      label="Reserva"
                      ajuda="Percentual retido por venda. 0% com a regra ligada não retém nada. Calculado sobre a base escolhida (bruto ou líquido)."
                      valor={f.percentualReserva ?? ''}
                      onChange={(v) => setF({ ...f, percentualReserva: v })}
                      disabled={!podeEditar}
                      className={celula}
                    />
                    <CampoInteiro
                      label="Manter por"
                      sufixo="dias"
                      ajuda="Quantos dias a reserva fica presa antes de liberar para o disponível. Ligar a regra com 0 dias parte de 30 por padrão."
                      valor={f.diasRetencaoReserva ?? '0'}
                      onChange={(v) => setF({ ...f, diasRetencaoReserva: v })}
                      disabled={!podeEditar}
                      className={celula}
                    />
                  </div>
                  <Segmentado
                    label="Base"
                    ajuda="Sobre qual valor o % de reserva é calculado: líquido (já sem taxa do gateway) ou bruto (valor cheio da venda)."
                    valor={baseReserva}
                    opcoes={BASES_RESERVA}
                    onChange={setBaseReserva}
                    disabled={!podeEditar}
                    className="!max-w-none"
                  />
                  {Number(f.percentualReserva ?? 0) > 0 ? (
                    <p className="text-[10px] opacity-55">
                      {(f.percentualReserva ?? '0').replace('.', ',')}% por{' '}
                      {prazoEmMeses(f.diasRetencaoReserva ?? '0')}.
                    </p>
                  ) : (
                    <Atencao>Informe o percentual (0% não retém).</Atencao>
                  )}
                </>
              ) : (
                <p className="text-[10px] opacity-55">Desligada: nada retido.</p>
              )}
            </Coluna>

            <Coluna titulo="Bloqueado MED">
              <Segmentado
                label="Modo MED"
                ajuda="MED sempre desconta saldo. Bloquear: move disponível→BLOQUEADO_MED (só o que existe) e manda o caso para /admin/med — a decisão ACEITO/RECUSADO liquida. Debitar direto: debita na hora, marca a venda como MED, avisa o lojista e encerra o caso sem fila; força saldo negativo permitido."
                valor={modoMed}
                opcoes={MODOS_MED}
                onChange={(v) => {
                  setModoMed(v);
                  if (v === MODO_TRATAMENTO_MED.DEBITAR_IMEDIATAMENTE) {
                    setSaldoNegativo(true);
                  }
                }}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {medExigeNegativo ? (
                <Atencao>Debita na hora, sem fila.</Atencao>
              ) : (
                <p className="text-[10px] opacity-55">
                  Bloqueia até a decisão em /admin/med.
                </p>
              )}
              <Interruptor
                label="Saldo negativo"
                ajuda="Permite a conta ficar negativa quando um MED debita. Obrigatório e travado no débito direto (a adquirente já levou o dinheiro). Saque continua exigindo saldo — nunca usa este flag. Só para dívida de MED."
                ligado={medExigeNegativo || saldoNegativo}
                onChange={setSaldoNegativo}
                disabled={!podeEditar || medExigeNegativo}
                className="!max-w-none"
              />
            </Coluna>

            <Coluna titulo="Saque">
              <Segmentado
                label="Origem"
                ajuda="Por onde o cliente pode pedir saque: só Painel, só API (escopo pix.saque.criar + IP allowlist) ou ambos. A origem inválida é recusada na criação e revalidada no processor 4-pix-cash-out."
                valor={origemSaque}
                opcoes={ORIGENS_SAQUE}
                onChange={setOrigemSaque}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              <Interruptor
                label="Só chave cadastrada"
                ajuda="Exige chave PIX cadastrada e APROVADA (painel) / escopo na API. Desligado: credencial vazada pode enviar para qualquer chave — risco alto. Vale para API e painel."
                ligado={exigirChave}
                onChange={setExigirChave}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {!exigirChave && (
                <Atencao>Credencial vazada envia a qualquer chave.</Atencao>
              )}
            </Coluna>

            <Coluna titulo="Adquirente">
              <Selecao
                label="Cash-in"
                ajuda="Adquirente/liquidante por onde as cobranças PIX in desta conta saem. A taxa do cliente não muda ao trocar — só o roteamento e o custo. “(manter)” não altera a conta atual."
                value={adqE}
                onChange={setAdqE}
                disabled={!podeEditar}
                className={celula}
              >
                <option value="">(manter)</option>
                {ativas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nome}
                  </option>
                ))}
              </Selecao>
              <Selecao
                label="Cash-out"
                ajuda="Adquirente usada nos saques desta conta. Independente do cash-in. Conta precisa estar ATIVA com pix saída habilitado."
                value={adqS}
                onChange={setAdqS}
                disabled={!podeEditar}
                className={celula}
              >
                <option value="">(manter)</option>
                {ativas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nome}
                  </option>
                ))}
              </Selecao>
            </Coluna>

            <Coluna titulo="Retenção (método)">
              <p className="text-[10px] leading-snug opacity-55">
                Ativo: % deste cliente. Inativo: % da adquirente. 0% libera tudo.
              </p>
              <Interruptor
                label="Método ativo"
                ajuda="Simulação/ferramenta interna (não aparece para o lojista). Ativo: usa percentualRetencaoMetodo desta conta. Inativo: usa o % da adquirente ou fallback global. Com 0% libera tudo. Não confundir com a reserva de garantia do saldo."
                ligado={retencaoAtiva}
                onChange={setRetencaoAtiva}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {retencaoAtiva && (
                <CampoPercentual
                  label="Percentual"
                  ajuda="Percentual de retenção método próprio deste cliente quando o método está ativo. 0% = libera tudo mesmo com o método ligado."
                  valor={percRetencao}
                  onChange={setPercRetencao}
                  disabled={!podeEditar}
                  className={celula}
                />
              )}
            </Coluna>

            <Coluna titulo="MED automático">
              <p className="text-[10px] leading-snug opacity-55">
                Converte venda de ontem em MED até este %. 0% = off.
              </p>
              <Interruptor
                label="MED automático"
                ajuda="Ferramenta interna de simulação. Ligado: após crédito de hoje, pode converter venda paga de ontem em MED até o percentual informado. Não aparece no painel do lojista. 0% ou inativo = não aplica."
                ligado={medAutoAtivo}
                onChange={setMedAutoAtivo}
                disabled={!podeEditar}
                className="!max-w-none"
              />
              {medAutoAtivo && (
                <CampoPercentual
                  label="% sobre fat. de ontem"
                  ajuda="Teto percentual sobre o faturamento de ontem para o MED automático. 0% efetivamente desliga a conversão mesmo com o toggle ligado."
                  valor={percMedAuto}
                  onChange={setPercMedAuto}
                  disabled={!podeEditar}
                  className={celula}
                />
              )}
            </Coluna>
          </div>
        </Grupo>
      </Faixa>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}
      {ok && !salvar.isPending && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Alterações salvas.
        </p>
      )}
      {!podeEditar ? (
        <p className="text-sm opacity-60">
          Seu perfil de acesso permite consultar, mas não alterar estes dados.
        </p>
      ) : (
        <ModalAcoes
          onCancelar={() => {
            setOk(false);
            setErro(null);
            void cfg.refetch();
            setSituacao(situacaoAtual);
          }}
          rotulo="Salvar alterações"
          pendente={salvar.isPending}
        />
      )}
    </form>
  );
}

/** Reset de 2FA e de senha — ações pontuais, fora do formulário que salva tudo. */
export function AcoesSeguranca({
  idPublico,
  token,
  totpHabilitado,
  forcarTrocaSenha,
  onAtualizar,
}: {
  idPublico: string;
  token: string;
  totpHabilitado: boolean;
  forcarTrocaSenha: boolean;
  onAtualizar: () => void;
}) {
  const { pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_USUARIOS_EDITAR);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmandoSenha, setConfirmandoSenha] = useState(false);

  const resetar2fa = useMutation({
    mutationFn: (codigoTotp: string) =>
      api(`/admin/usuarios/${idPublico}/resetar-2fa`, {
        token,
        method: 'POST',
        body: JSON.stringify({ codigoTotp }),
      }),
    onSuccess: () => {
      setErro(null);
      setOk('2FA desligado. O titular pode ativar de novo em Configurações.');
      onAtualizar();
    },
    onError: (e) => {
      setOk(null);
      setErro(erroMsg(e));
    },
  });

  const resetarSenha = useMutation({
    mutationFn: (codigoTotp: string) =>
      api<{ senhaProvisoria: string }>(`/admin/usuarios/${idPublico}/resetar-senha`, {
        token,
        method: 'POST',
        body: JSON.stringify({ codigoTotp }),
      }),
    onSuccess: (r) => {
      setErro(null);
      setOk(null);
      setConfirmandoSenha(false);
      setSenhaGerada(r.senhaProvisoria);
      onAtualizar();
    },
    onError: (e) => {
      setConfirmandoSenha(false);
      setErro(erroMsg(e));
    },
  });

  return (
    <div className="space-y-4">
      {ok && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {ok}
        </p>
      )}
      {erro && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}

      {/* Fica em coluna única: este bloco divide a linha com "IPs autorizados". */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="rounded-xl border border-ink-800/10 p-3.5 dark:border-white/10">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden />
            Verificação em duas etapas
          </p>
          <p className="mt-1 text-xs opacity-60">
            {totpHabilitado
              ? 'Ativa nesta conta. Desligue apenas quando o titular perdeu o aparelho — ele mesmo religa depois.'
              : 'Não está ativa. Só o titular pode ativar, no painel dele.'}
          </p>
          <button
            type="button"
            disabled={!podeEditar || !totpHabilitado || resetar2fa.isPending}
            onClick={() => {
              const codigoTotp = pedirCodigoTotp(
                'Confirme o reset de 2FA com o código da sua conta admin:',
              );
              if (!codigoTotp) return;
              resetar2fa.mutate(codigoTotp);
            }}
            className="mt-3 rounded-lg border border-red-500/40 px-3.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
          >
            {resetar2fa.isPending ? 'Desligando…' : 'Resetar 2FA'}
          </button>
        </div>

        <div className="rounded-xl border border-ink-800/10 p-3.5 dark:border-white/10">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden />
            Senha de acesso
          </p>
          <p className="mt-1 text-xs opacity-60">
            Gera uma senha provisória. O login fica bloqueado até o titular criar a
            senha definitiva.
          </p>
          {forcarTrocaSenha && (
            <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
              Já existe uma troca de senha pendente nesta conta.
            </p>
          )}

          {!confirmandoSenha ? (
            <button
              type="button"
              disabled={!podeEditar || resetarSenha.isPending}
              onClick={() => {
                setSenhaGerada(null);
                setConfirmandoSenha(true);
              }}
              className="mt-3 rounded-lg border border-ink-800/15 px-3.5 py-1.5 text-sm font-medium transition hover:bg-ink-800/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5"
            >
              Resetar senha
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs">
                A senha atual do titular deixa de funcionar imediatamente. Confirma?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmandoSenha(false)}
                  className="rounded-lg border border-ink-800/15 px-3.5 py-1.5 text-sm dark:border-white/15"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={resetarSenha.isPending}
                  onClick={() => {
                    const codigoTotp = pedirCodigoTotp(
                      'Confirme o reset de senha com o código da sua conta admin:',
                    );
                    if (!codigoTotp) return;
                    resetarSenha.mutate(codigoTotp);
                  }}
                  className="rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {resetarSenha.isPending ? 'Gerando…' : 'Confirmar reset'}
                </button>
              </div>
            </div>
          )}

          {senhaGerada && (
            <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold">
                Repasse ao titular — aparece uma única vez:
              </p>
              <p className="mt-1.5 break-all rounded bg-white/60 px-2 py-1.5 font-mono text-sm dark:bg-black/30">
                {senhaGerada}
              </p>
              <button
                type="button"
                onClick={() => setSenhaGerada(null)}
                className="mt-2 text-xs underline"
              >
                Já copiei, ocultar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type CredencialIps = {
  id: string;
  nome: string;
  chavePublica: string;
  ips: Array<{ id: string; ip: string }>;
};

/** IPs liberados nas chaves de API da conta — visão e edição pelo admin. */
export function IpsAutorizados({
  idPublico,
  token,
}: {
  idPublico: string;
  token: string;
}) {
  const { pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_USUARIOS_EDITAR);
  const qc = useQueryClient();
  const [novos, setNovos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const chave = ['usuario-ips', idPublico];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => api<CredencialIps[]>(`/admin/usuarios/${idPublico}/ips`, { token }),
  });

  const recarregar = () => void qc.invalidateQueries({ queryKey: chave });

  const adicionar = useMutation({
    mutationFn: (v: { credencialId: string; ip: string; codigoTotp: string }) =>
      api(`/admin/usuarios/${idPublico}/ips`, {
        token,
        method: 'POST',
        body: JSON.stringify(v),
      }),
    onSuccess: (_r, v) => {
      setErro(null);
      setNovos((n) => ({ ...n, [v.credencialId]: '' }));
      recarregar();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const remover = useMutation({
    mutationFn: (p: { ipId: string; codigoTotp: string }) =>
      api(`/admin/usuarios/${idPublico}/ips/${p.ipId}`, {
        token,
        method: 'DELETE',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () => {
      setErro(null);
      recarregar();
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  if (q.isLoading) return <p className="text-sm opacity-60">Carregando chaves…</p>;
  if (!q.data?.length) {
    return (
      <p className="text-sm opacity-60">
        Esta conta não tem chave de API ativa — não há allowlist para configurar.
      </p>
    );
  }

  function submeter(e: FormEvent, credencialId: string) {
    e.preventDefault();
    const ip = (novos[credencialId] ?? '').trim();
    if (!ip) return;
    const codigoTotp = pedirCodigoTotp();
    if (!codigoTotp) return;
    adicionar.mutate({ credencialId, ip, codigoTotp });
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}
      {q.data.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-ink-800/10 p-3.5 dark:border-white/10"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{c.nome}</p>
            <p className="font-mono text-[11px] opacity-50">{c.chavePublica}</p>
          </div>

          {c.ips.length > 0 ? (
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {c.ips.map((i) => (
                <li
                  key={i.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink-800/[0.06] py-1 pl-3 pr-1.5 font-mono text-xs dark:bg-white/[0.08]"
                >
                  {i.ip}
                  {podeEditar && (
                    <button
                      type="button"
                      aria-label={`Remover ${i.ip}`}
                      onClick={() => {
                        const codigoTotp = pedirCodigoTotp();
                        if (!codigoTotp) return;
                        remover.mutate({ ipId: i.id, codigoTotp });
                      }}
                      className="rounded-full p-0.5 opacity-60 transition hover:bg-red-500/20 hover:text-red-600 hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs">
              Sem restrição: esta chave funciona de qualquer IP.
            </p>
          )}

          {podeEditar && (
            <form onSubmit={(e) => submeter(e, c.id)} className="mt-3 flex gap-2">
              <input
                className={`${campo} mt-0 flex-1 font-mono`}
                value={novos[c.id] ?? ''}
                onChange={(e) => setNovos((n) => ({ ...n, [c.id]: e.target.value }))}
                placeholder="203.0.113.10 ou 198.51.100.0/24"
              />
              <button
                type="submit"
                disabled={!(novos[c.id] ?? '').trim() || adicionar.isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink-800/15 px-3 text-sm font-medium transition hover:bg-ink-800/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5"
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                Liberar
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

export const ICONES = { SlidersHorizontal, ShieldCheck, Network };
