'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  History,
  Network,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { Shell } from '@/components/shell';
import { DocumentosAdmin } from '@/components/documentos-admin';
import { TelefoneWhatsApp } from '@/components/whatsapp';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';
import { formatarDataHora } from '@/lib/fuso';
import { gradeLeitura } from '@/components/campos';
import {
  BaseCalculoReserva,
  BASES_RESERVA,
  ModoTratamentoMed,
  MODOS_MED,
} from '@/lib/config-comercial';
import { FormularioDadosCadastrais } from './dados-cadastrais';
import {
  AcoesSeguranca,
  Bloco,
  erroMsg,
  FormularioOperacao,
  IpsAutorizados,
} from './painel-operacional';

type Endereco = {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

type ResumoDocs = { total: number; pendentes: number; validos: number; invalidos: number };

type Detalhe = {
  idPublico: string;
  tipoPessoa: 'PF' | 'PJ';
  cpfCnpj: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  email: string;
  telefone: string | null;
  situacao: string;
  contaBloqueada: boolean;
  forcarTrocaSenha: boolean;
  totpHabilitado: boolean;
  totpAtivadoEm: string | null;
  responsavel: { nome: string | null; cpf: string | null };
  endereco: Endereco | null;
  faturamentoMensalMedio: string | null;
  papeis: string[];
  motivoReprovacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  ultimoAcessoEm: string | null;
  ativadoEm: string | null;
  ativadoPor: { nome: string; email: string } | null;
  documentos: { resumo: ResumoDocs; faltantes: string[] };
  saldo: {
    disponivel: string;
    pendenteLiberacao: string;
    reservado: string;
    bloqueadoMed: string;
    bloqueadoManual: string;
    atualizadoEm: string;
  } | null;
  regras: {
    diasLiberacaoSaldo: number;
    percentualReserva: string;
    diasRetencaoReserva: number;
    baseCalculoReserva: BaseCalculoReserva;
    modoTratamentoMed: ModoTratamentoMed;
  } | null;
  historicoSituacao: Array<{
    id: string;
    situacaoAnterior: string | null;
    novaSituacao: string;
    motivo: string | null;
    enderecoIp: string | null;
    criadoEm: string;
  }>;
  aceitesLegais: Array<{
    id: string;
    documento: string;
    versao: string;
    enderecoIp: string | null;
    agenteUsuario: string | null;
    aceitoEm: string;
  }>;
};

const corSituacao = (s: string) => {
  if (['ATIVO', 'ATIVA', 'VALIDO'].includes(s))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (['SUSPENSO', 'EM_ANALISE', 'PENDENTE'].includes(s))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
};

const dataHora = (iso: string | null) => formatarDataHora(iso);

const rotuloModoMed = (v: ModoTratamentoMed) =>
  MODOS_MED.find((m) => m.v === v)?.label ?? v;

const rotuloBaseReserva = (v: BaseCalculoReserva) =>
  BASES_RESERVA.find((b) => b.v === v)?.label.toLowerCase() ?? v;

const dinheiro = (v: string | null) =>
  v === null
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Badge({ texto }: { texto: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${corSituacao(texto)}`}>
      {texto}
    </span>
  );
}

/** Bloco só-leitura da ficha (consulta), visualmente mais leve que os editáveis. */
function Secao({
  icone: Icone,
  titulo,
  descricao,
  children,
}: {
  icone: React.ElementType;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-800/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-start gap-2.5">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 opacity-50" strokeWidth={1.75} aria-hidden />
        <div>
          <h2 className="font-display text-sm font-semibold leading-tight">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-[11px] opacity-55">{descricao}</p>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Par rótulo/valor. Uma coluna no celular, duas ou três a partir do sm. */
function Campo({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase leading-tight tracking-wide opacity-50">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[13px]">{valor || '—'}</dd>
    </div>
  );
}

function Grade({ children }: { children: ReactNode }) {
  return <dl className={gradeLeitura}>{children}</dl>;
}

function ResumoDocumentos({
  resumo,
  faltantes,
}: {
  resumo: ResumoDocs;
  faltantes: string[];
}) {
  return (
    <div className="mb-3 space-y-1 text-xs">
      <p className="opacity-60">
        {resumo.total} enviado(s) · {resumo.validos} válido(s) · {resumo.pendentes}{' '}
        pendente(s) · {resumo.invalidos} inválido(s)
      </p>
      {faltantes.length > 0 && (
        <p className="text-amber-600">Faltando: {faltantes.join(', ')}</p>
      )}
    </div>
  );
}

export default function UsuarioDetalhePage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const params = useParams<{ idPublico: string }>();
  const idPublico = params.idPublico;

  const q = useQuery({
    queryKey: ['usuario-detalhe', idPublico],
    enabled: !!token && !!idPublico,
    queryFn: () =>
      api<Detalhe>(`/admin/usuarios/${idPublico}/detalhe`, { token: token! }),
  });

  const recarregar = () =>
    void qc.invalidateQueries({ queryKey: ['usuario-detalhe', idPublico] });

  const u = q.data;
  const pj = u?.tipoPessoa === 'PJ';

  return (
    <Shell>
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-1.5 text-sm opacity-70 transition hover:opacity-100"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Usuários
      </Link>

      {q.isLoading && <p className="mt-6 text-sm opacity-60">Carregando ficha…</p>}
      {q.isError && (
        <p className="mt-6 text-sm text-red-600">
          Não foi possível carregar este usuário. {erroMsg(q.error)}
        </p>
      )}

      {u && token && (
        <div className="mt-4 space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                {u.nomeRazaoSocial}
              </h1>
              <p className="mt-1 break-words text-sm opacity-70">
                {u.email} · {formatarDocumento(u.cpfCnpj)}
                {u.telefone && (
                  <>
                    {' · '}
                    <TelefoneWhatsApp telefone={u.telefone} />
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge texto={u.situacao} />
              <span className="rounded bg-ink-800/10 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/10">
                {u.tipoPessoa}
              </span>
              {u.papeis.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-ink-800/15 px-2 py-0.5 text-[10px] font-medium dark:border-white/15"
                >
                  {p}
                </span>
              ))}
              <Link
                href="/admin/perfis"
                className="text-[11px] underline opacity-60 transition hover:opacity-100"
              >
                alterar perfis
              </Link>
            </div>
          </header>

          {u.motivoReprovacao && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
              Motivo da reprovação: {u.motivoReprovacao}
            </p>
          )}

          {/* ── O que se altera vem primeiro ──────────────────────────────── */}
          <Bloco
            icone={SlidersHorizontal}
            titulo="Operação e condições comerciais"
            descricao="Situação, limites de PIX in/out, regras de saque, taxas e adquirente."
          >
            <FormularioOperacao
              idPublico={u.idPublico}
              situacaoAtual={u.situacao}
              token={token}
              onSalvo={recarregar}
            />
          </Bloco>

          {/* Dois blocos independentes lado a lado no desktop. */}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Bloco
              perigo
              icone={ShieldCheck}
              titulo="Segurança da conta"
              descricao="Ações pontuais — cada botão vale por si, não dependem de salvar."
            >
              <AcoesSeguranca
                idPublico={u.idPublico}
                token={token}
                totpHabilitado={u.totpHabilitado}
                forcarTrocaSenha={u.forcarTrocaSenha}
                onAtualizar={recarregar}
              />
            </Bloco>

            <Bloco
              icone={Network}
              titulo="IPs autorizados na API"
              descricao="Allowlist de cada chave de API da conta. Chave sem IP aceita qualquer origem."
            >
              <IpsAutorizados idPublico={u.idPublico} token={token} />
            </Bloco>
          </div>

          <Bloco
            icone={FileText}
            titulo={pj ? 'Documentos do responsável e da empresa' : 'Documentos do titular'}
            descricao="Consulte, baixe ou valide a documentação enviada."
          >
            <ResumoDocumentos
              resumo={u.documentos.resumo}
              faltantes={u.documentos.faltantes}
            />
            <DocumentosAdmin
              idPublico={u.idPublico}
              token={token}
              tipoPessoa={u.tipoPessoa}
              onAtualizar={recarregar}
            />
          </Bloco>

          <FormularioDadosCadastrais
            idPublico={u.idPublico}
            token={token}
            onSalvo={recarregar}
            ficha={{
              tipoPessoa: u.tipoPessoa,
              cpfCnpj: u.cpfCnpj,
              nomeRazaoSocial: u.nomeRazaoSocial,
              nomeFantasia: u.nomeFantasia,
              email: u.email,
              telefone: u.telefone,
              responsavel: u.responsavel,
              endereco: u.endereco,
              faturamentoMensalMedio: u.faturamentoMensalMedio,
            }}
          />

          {/* ── Consulta ──────────────────────────────────────────────────── */}
          <Secao
            icone={Wallet}
            titulo="Carteira"
            descricao="Saldo do cliente no ledger. Movimenta só por transação, MED ou saque."
          >
            {u.saldo ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-5">
                  <Campo label="Disponível" valor={dinheiro(u.saldo.disponivel)} />
                  <Campo label="A liberar" valor={dinheiro(u.saldo.pendenteLiberacao)} />
                  <Campo label="Reservado" valor={dinheiro(u.saldo.reservado)} />
                  <Campo label="Bloqueado MED" valor={dinheiro(u.saldo.bloqueadoMed)} />
                  <Campo label="Bloqueado adm." valor={dinheiro(u.saldo.bloqueadoManual)} />
                </dl>
                {u.regras && (
                  <p className="mt-3 text-[11px] leading-relaxed opacity-55">
                    Regras desta conta: liberação em{' '}
                    <strong>D+{u.regras.diasLiberacaoSaldo}</strong> · reserva de{' '}
                    <strong>
                      {u.regras.percentualReserva.replace('.', ',')}%
                    </strong>{' '}
                    ({rotuloBaseReserva(u.regras.baseCalculoReserva)}) por{' '}
                    <strong>{u.regras.diasRetencaoReserva} dia(s)</strong> · MED:{' '}
                    <strong>{rotuloModoMed(u.regras.modoTratamentoMed)}</strong>
                    {u.regras.modoTratamentoMed === 'DEBITAR_IMEDIATAMENTE' &&
                      ' — contestação debita o saldo direto, sem passar por análise'}
                    . Altere em “Operação e condições comerciais”, no topo.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm opacity-60">
                Carteira ainda não aberta — ela nasce na ativação da conta.
              </p>
            )}
          </Secao>

          <Secao icone={History} titulo="Conta e acesso">
            <Grade>
              <Campo label="Situação" valor={<Badge texto={u.situacao} />} />
              <Campo label="Conta bloqueada" valor={u.contaBloqueada ? 'Sim' : 'Não'} />
              <Campo
                label="2FA (TOTP)"
                valor={
                  u.totpHabilitado
                    ? `Ativo desde ${dataHora(u.totpAtivadoEm)}`
                    : 'Não habilitado'
                }
              />
              <Campo
                label="Forçar troca de senha"
                valor={u.forcarTrocaSenha ? 'Sim' : 'Não'}
              />
              <Campo label="Cadastrado em" valor={dataHora(u.criadoEm)} />
              <Campo label="Último acesso" valor={dataHora(u.ultimoAcessoEm)} />
              <Campo label="Ativado em" valor={dataHora(u.ativadoEm)} />
              <Campo
                label="Ativado por"
                valor={u.ativadoPor ? `${u.ativadoPor.nome} (${u.ativadoPor.email})` : null}
              />
              <Campo label="Última atualização" valor={dataHora(u.atualizadoEm)} />
            </Grade>
          </Secao>

          <Secao icone={History} titulo="Histórico de situação">
            {u.historicoSituacao.length === 0 ? (
              <p className="text-sm opacity-60">Nenhuma mudança registrada.</p>
            ) : (
              <ul className="space-y-2">
                {u.historicoSituacao.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="opacity-60">{h.situacaoAnterior ?? '—'}</span>
                      <span className="opacity-40">→</span>
                      <Badge texto={h.novaSituacao} />
                      <span className="ml-auto text-xs opacity-60">
                        {dataHora(h.criadoEm)}
                      </span>
                    </div>
                    {h.motivo && <p className="mt-1 text-xs opacity-70">{h.motivo}</p>}
                    {h.enderecoIp && (
                      <p className="mt-0.5 text-xs opacity-50">IP: {h.enderecoIp}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao
            icone={ScrollText}
            titulo="Aceites legais"
            descricao="Assinatura eletrônica dos documentos no cadastro."
          >
            {u.aceitesLegais.length === 0 ? (
              <p className="text-sm opacity-60">Nenhum aceite registrado.</p>
            ) : (
              <ul className="space-y-2">
                {u.aceitesLegais.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {a.documento}{' '}
                        <span className="text-xs font-normal opacity-60">v{a.versao}</span>
                      </p>
                      <span className="text-xs opacity-60">{dataHora(a.aceitoEm)}</span>
                    </div>
                    <p className="mt-0.5 break-all text-xs opacity-50">
                      IP: {a.enderecoIp ?? '—'}
                      {a.agenteUsuario ? ` · ${a.agenteUsuario}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      )}
    </Shell>
  );
}
