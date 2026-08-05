'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Shell } from '@/components/shell';
import { DocumentosAdmin } from '@/components/documentos-admin';
import { ModalAcoes } from '@/components/modal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { formatarDocumento, mascaraCep, mascaraTelefone } from '@/lib/documento';

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
    atualizadoEm: string;
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

const SITUACOES_EDITAVEIS = ['ATIVO', 'SUSPENSO', 'BLOQUEADO', 'ENCERRADO'];
const EM_ONBOARDING = (s: string) => s === 'PENDENTE' || s === 'EM_ANALISE';

const CAMPOS_TAXA: Array<[string, string]> = [
  ['taxaPixEntradaPercentual', 'Cash-in %'],
  ['taxaPixEntradaFixa', 'Cash-in fixo (R$)'],
  ['taxaPixSaidaPercentual', 'Cash-out %'],
  ['taxaPixSaidaFixa', 'Cash-out fixo (R$)'],
  ['diasLiberacaoSaldo', 'Dias p/ liberar saldo'],
  ['percentualReserva', '% de reserva'],
];

const campo =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900';

const corSituacao = (s: string) => {
  if (['ATIVO', 'ATIVA', 'VALIDO'].includes(s))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  if (['SUSPENSO', 'EM_ANALISE', 'PENDENTE'].includes(s))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
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

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

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

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink-800/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
      <h2 className="font-display text-lg font-semibold">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-xs opacity-60">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Par rótulo/valor. Uma coluna no celular, duas ou três a partir do sm. */
function Campo({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide opacity-50">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{valor || '—'}</dd>
    </div>
  );
}

function Grade({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
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

/** Taxas, adquirente de roteamento e situação — a parte editável da ficha. */
function FormularioComercial({
  idPublico,
  situacaoAtual,
  perfisAtuais,
  token,
  onSalvo,
}: {
  idPublico: string;
  situacaoAtual: string;
  perfisAtuais: string[];
  token: string;
  onSalvo: () => void;
}) {
  const { pode } = useAuth();
  const podeEditar = pode(PERMISSOES.ADMIN_USUARIOS_EDITAR);
  const [situacao, setSituacao] = useState(situacaoAtual);
  const [perfis, setPerfis] = useState<string[]>(perfisAtuais);
  const [f, setF] = useState<Record<string, string>>({});
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
      api<Array<{ codigo: string; nome: string; situacao: string }>>('/admin/provedores', {
        token,
      }),
  });
  const perfisDisponiveis = useQuery({
    queryKey: ['perfis-disponiveis'],
    queryFn: () =>
      api<Array<{ nome: string; descricao: string | null }>>(
        '/admin/usuarios/perfis-disponiveis',
        { token },
      ),
  });

  useEffect(() => setSituacao(situacaoAtual), [situacaoAtual]);
  // Compara pelo conteúdo: a prop é um array novo a cada render do pai.
  const chavePerfis = [...perfisAtuais].sort().join(',');
  useEffect(() => {
    setPerfis(chavePerfis ? chavePerfis.split(',') : []);
  }, [chavePerfis]);
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

  const onboarding = EM_ONBOARDING(situacaoAtual);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!onboarding && situacao !== situacaoAtual) {
        await api(`/admin/usuarios/${idPublico}/situacao`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ situacao }),
        });
      }
      if (chavePerfis !== [...perfis].sort().join(',')) {
        await api(`/admin/usuarios/${idPublico}/perfis`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ perfis }),
        });
      }
      await api(`/admin/usuarios/${idPublico}/config`, {
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
      className="space-y-5"
    >
      <label className="block max-w-sm text-sm">
        Situação da conta
        <select
          className={campo}
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          disabled={onboarding}
        >
          {(onboarding ? [situacaoAtual, ...SITUACOES_EDITAVEIS] : SITUACOES_EDITAVEIS).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        {onboarding && (
          <span className="mt-1 block text-xs text-amber-600">
            Cadastro em análise — aprove ou reprove em{' '}
            <Link href="/admin/aprovacoes" className="underline">
              Aprovações
            </Link>
            .
          </span>
        )}
      </label>

      <div>
        <p className="text-sm font-medium">Perfis de acesso</p>
        <p className="mt-0.5 text-xs opacity-60">
          Definem as telas que a pessoa abre e o que pode fazer. Vale na
          requisição seguinte — não precisa esperar novo login.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {(perfisDisponiveis.data ?? []).map((p) => (
            <label key={p.nome} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-current"
                checked={perfis.includes(p.nome)}
                onChange={(e) =>
                  setPerfis((atual) =>
                    e.target.checked
                      ? [...atual, p.nome]
                      : atual.filter((n) => n !== p.nome),
                  )
                }
              />
              <span>
                {p.descricao || p.nome}
                <span className="ml-1.5 font-mono text-xs opacity-50">{p.nome}</span>
              </span>
            </label>
          ))}
          {!perfisDisponiveis.data?.length && (
            <span className="text-xs opacity-60">
              {perfisDisponiveis.isLoading ? 'Carregando…' : 'Nenhum perfil ativo.'}
            </span>
          )}
        </div>
        {!perfis.length && (
          <p className="mt-2 text-xs text-amber-600">
            Sem perfil, a pessoa entra no painel mas não abre nenhuma tela.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Taxas (o que o gateway cobra)</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        {cfg.data && !cfg.data.temConfig && (
          <p className="mt-2 text-xs opacity-60">
            Este usuário ainda usa a configuração padrão do sistema. Salvar cria uma
            configuração própria.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Adquirente de roteamento</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      {ok && !salvar.isPending && (
        <p className="text-sm text-emerald-600">Alterações salvas.</p>
      )}
      {!podeEditar && (
        <p className="text-sm opacity-60">
          Seu perfil de acesso permite consultar, mas não alterar estes dados.
        </p>
      )}
      {podeEditar && (
        <ModalAcoes
          onCancelar={() => {
            setOk(false);
            setErro(null);
            cfg.refetch();
            setSituacao(situacaoAtual);
          }}
          rotulo="Salvar alterações"
          pendente={salvar.isPending}
        />
      )}
    </form>
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
        <div className="mt-4 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                {u.nomeRazaoSocial}
              </h1>
              <p className="mt-1 break-words text-sm opacity-70">
                {u.email} · {formatarDocumento(u.cpfCnpj)}
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
            </div>
          </header>

          {u.motivoReprovacao && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
              Motivo da reprovação: {u.motivoReprovacao}
            </p>
          )}

          <Secao
            titulo={pj ? 'Dados cadastrais' : 'Dados pessoais'}
            descricao="Informações declaradas no cadastro."
          >
            <Grade>
              <Campo label="Tipo de pessoa" valor={u.tipoPessoa} />
              <Campo
                label={pj ? 'CNPJ' : 'CPF'}
                valor={formatarDocumento(u.cpfCnpj)}
              />
              <Campo
                label={pj ? 'Razão social' : 'Nome completo'}
                valor={u.nomeRazaoSocial}
              />
              <Campo label="Nome fantasia" valor={u.nomeFantasia} />
              <Campo label="E-mail" valor={u.email} />
              <Campo
                label="Telefone"
                valor={u.telefone ? mascaraTelefone(u.telefone) : null}
              />
              <Campo
                label="Faturamento mensal médio"
                valor={dinheiro(u.faturamentoMensalMedio)}
              />
              <Campo
                label={pj ? 'Responsável pela conta' : 'Titular'}
                valor={u.responsavel.nome}
              />
              <Campo
                label={pj ? 'CPF do responsável' : 'CPF do titular'}
                valor={u.responsavel.cpf ? formatarDocumento(u.responsavel.cpf) : null}
              />
            </Grade>
          </Secao>

          <Secao titulo="Endereço">
            {u.endereco ? (
              <Grade>
                <Campo
                  label="CEP"
                  valor={u.endereco.cep ? mascaraCep(u.endereco.cep) : null}
                />
                <Campo label="Logradouro" valor={u.endereco.logradouro} />
                <Campo label="Número" valor={u.endereco.numero} />
                <Campo label="Complemento" valor={u.endereco.complemento} />
                <Campo label="Bairro" valor={u.endereco.bairro} />
                <Campo
                  label="Cidade / UF"
                  valor={
                    u.endereco.cidade
                      ? `${u.endereco.cidade}${u.endereco.uf ? ` / ${u.endereco.uf}` : ''}`
                      : null
                  }
                />
              </Grade>
            ) : (
              <p className="text-sm opacity-60">Nenhum endereço cadastrado.</p>
            )}
          </Secao>

          <Secao titulo="Conta e acesso">
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

          <Secao
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
              onAtualizar={recarregar}
            />
          </Secao>

          <Secao
            titulo="Carteira"
            descricao="Saldo do cliente no ledger. Movimenta só por transação, MED ou saque."
          >
            {u.saldo ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
                <Campo label="Disponível" valor={dinheiro(u.saldo.disponivel)} />
                <Campo label="A liberar" valor={dinheiro(u.saldo.pendenteLiberacao)} />
                <Campo label="Reservado" valor={dinheiro(u.saldo.reservado)} />
                <Campo label="Bloqueado MED" valor={dinheiro(u.saldo.bloqueadoMed)} />
              </dl>
            ) : (
              <p className="text-sm opacity-60">
                Carteira ainda não aberta — ela nasce na ativação da conta.
              </p>
            )}
          </Secao>

          <Secao
            titulo="Acesso e condições comerciais"
            descricao="Situação da conta, perfis de acesso, taxas cobradas e adquirente de roteamento."
          >
            <FormularioComercial
              idPublico={u.idPublico}
              situacaoAtual={u.situacao}
              perfisAtuais={u.papeis}
              token={token}
              onSalvo={recarregar}
            />
          </Secao>

          <Secao titulo="Histórico de situação">
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
