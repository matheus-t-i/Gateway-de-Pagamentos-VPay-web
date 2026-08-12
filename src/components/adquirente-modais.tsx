'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Shield,
  Store,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { pedirTexto } from '@/lib/dialogos';
import { CampoMoeda, CampoPercentual, controleBase } from './campos';
import { Modal, ModalAcoes } from './modal';
import { TextoRotulo } from './obrigatorio';
import { SeletorSituacao } from './status';

const campo = `mt-1 ${controleBase} px-3 py-2`;

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
type Disponibilidade = 'TODOS' | 'ESPECIFICOS';
type Detalhe = {
  codigo: string;
  nome: string;
  nomeFantasia: string | null;
  temMed: boolean;
  observacaoCliente: string | null;
  disponibilidadePixEntrada: Disponibilidade;
  situacao: Situacao;
  permitePixEntrada: boolean;
  permitePixSaida: boolean;
  ipsWebhook: string[];
  contas: Conta[];
};

/**
 * Lista editável de IPs/faixas de webhook da liquidante. Aceita IPv4 e IPv6,
 * com ou sem CIDR (ex.: 187.10.0.5, 187.10.0.0/24, 2804:14c::/64) — a
 * validação de verdade é do servidor; aqui só se evita entrada vazia.
 */
function CampoIpsWebhook({
  ips,
  onChange,
}: {
  ips: string[];
  onChange: (ips: string[]) => void;
}) {
  const [novo, setNovo] = useState('');
  const adicionar = () => {
    const v = novo.trim();
    if (!v || ips.includes(v)) return;
    onChange([...ips, v]);
    setNovo('');
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed opacity-55">
        Só estes IPs/faixas entregam webhook (Camada 2). Aceita CIDR e IPv6.
        Lista vazia desliga a checagem.
      </p>
      <div className="flex items-end gap-2">
        <label className="block min-w-0 flex-1 text-xs">
          IP ou faixa (CIDR)
          <input
            className={campo}
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="ex.: 2804:14c::/64"
          />
        </label>
        <button
          type="button"
          onClick={adicionar}
          disabled={!novo.trim()}
          className="h-9 shrink-0 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
      {ips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {ips.map((ip) => (
            <li
              key={ip}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-800/[0.06] py-1 pl-2.5 pr-1 font-mono text-[11px] dark:bg-white/[0.06]"
            >
              {ip}
              <button
                type="button"
                aria-label={`Remover ${ip}`}
                onClick={() => onChange(ips.filter((i) => i !== ip))}
                className="rounded-full p-0.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Nenhum IP — a checagem de origem está desligada.
        </p>
      )}
    </div>
  );
}

function Bloco({
  icone,
  titulo,
  descricao,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-ink-800/10 bg-ink-800/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.02]">
      <header className="flex items-start gap-2.5">
        <span className="mt-0.5 text-accent">{icone}</span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{titulo}</h4>
          {descricao ? (
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-55">{descricao}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function Interruptor({
  ligado,
  onChange,
  icone,
  titulo,
  dica,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  icone: ReactNode;
  titulo: string;
  dica: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ligado)}
      aria-pressed={ligado}
      className={`flex flex-1 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
        ligado
          ? 'border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-400/25 dark:bg-emerald-400/10'
          : 'border-ink-800/10 bg-ink-800/[0.02] opacity-70 hover:opacity-100 dark:border-white/10 dark:bg-white/[0.02]'
      }`}
    >
      <span className={ligado ? 'text-emerald-600 dark:text-emerald-300' : 'opacity-50'}>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-[11px] opacity-60">{dica}</span>
      </span>
    </button>
  );
}

type ClienteAfetado = {
  idPublico: string;
  nome: string;
  email: string;
  cpfCnpj: string;
};
type Alternativa = { codigo: string; nome: string };
type Impacto = { clientes: ClienteAfetado[]; alternativas: Alternativa[] };

const SITUACOES: Situacao[] = ['ATIVO', 'INATIVO', 'SUSPENSO'];

/**
 * Painel de substituição obrigatória: aparece quando a mudança tira a
 * adquirente de circulação e existem clientes usando-a no PIX in. Nenhuma
 * confirmação passa enquanto todos não tiverem destino.
 */
function PainelSubstituicao({
  impacto,
  destinos,
  onDestino,
  onTodos,
}: {
  impacto: Impacto;
  destinos: Record<string, string>;
  onDestino: (idPublico: string, codigo: string) => void;
  onTodos: (codigo: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/30">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {impacto.clientes.length} cliente(s) usam esta adquirente no PIX in.
        Escolha a substituta de cada um para continuar.
      </p>

      {impacto.alternativas.length === 0 ? (
        <p className="text-xs text-red-700 dark:text-red-300">
          Não há outra adquirente apta a receber PIX in. Cadastre/ative uma antes
          de tirar esta de circulação.
        </p>
      ) : (
        <>
          <label className="block text-xs">
            Aplicar a todos
            <select
              className={campo}
              defaultValue=""
              onChange={(e) => e.target.value && onTodos(e.target.value)}
            >
              <option value="">Selecione…</option>
              {impacto.alternativas.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>

          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {impacto.clientes.map((c) => (
              <li key={c.idPublico} className="text-xs">
                <p className="font-medium">{c.nome}</p>
                <p className="opacity-60">{c.email}</p>
                <select
                  className={campo}
                  value={destinos[c.idPublico] ?? ''}
                  onChange={(e) => onDestino(c.idPublico, e.target.value)}
                >
                  <option value="">Selecione a nova adquirente…</option>
                  {impacto.alternativas.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

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
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [temMed, setTemMed] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>('ESPECIFICOS');
  const [situacao, setSituacao] = useState<Situacao>('ATIVO');
  const [entrada, setEntrada] = useState(false);
  const [saida, setSaida] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [ipsWebhook, setIpsWebhook] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const [exigeSubstituicao, setExigeSubstituicao] = useState(false);

  const det = useQuery({
    queryKey: ['adq-det', codigo],
    enabled: !!codigo,
    queryFn: () => api<Detalhe>(`/admin/adquirentes/${codigo}`, { token }),
  });
  useEffect(() => {
    if (det.data) {
      setNome(det.data.nome);
      setNomeFantasia(det.data.nomeFantasia ?? '');
      setTemMed(det.data.temMed);
      setObservacao(det.data.observacaoCliente ?? '');
      setDisponibilidade(det.data.disponibilidadePixEntrada);
      setSituacao(det.data.situacao);
      setEntrada(det.data.permitePixEntrada);
      setSaida(det.data.permitePixSaida);
      setContas(det.data.contas);
      setIpsWebhook(det.data.ipsWebhook ?? []);
      setDestinos({});
      setExigeSubstituicao(false);
    }
  }, [det.data]);

  /**
   * A mudança tira a adquirente de circulação para o PIX in? É o que decide se
   * a substituição passa a ser obrigatória.
   */
  const saiDeCirculacao = useMemo(() => {
    const d = det.data;
    if (!d) return false;
    return (
      (d.situacao === 'ATIVO' && situacao !== 'ATIVO') ||
      (d.permitePixEntrada && !entrada) ||
      (d.disponibilidadePixEntrada === 'TODOS' && disponibilidade === 'ESPECIFICOS')
    );
  }, [det.data, situacao, entrada, disponibilidade]);

  const impacto = useQuery({
    queryKey: ['adq-impacto', codigo],
    enabled: !!codigo && saiDeCirculacao,
    queryFn: () =>
      api<Impacto>(`/admin/adquirentes/${codigo}/impacto-pix-entrada`, { token }),
  });

  const precisaSubstituir = saiDeCirculacao && (impacto.data?.clientes.length ?? 0) > 0;
  const substituicoes = useMemo(
    () =>
      (impacto.data?.clientes ?? [])
        .map((c) => ({
          usuarioIdPublico: c.idPublico,
          adquirenteCodigo: destinos[c.idPublico] ?? '',
        }))
        .filter((s) => s.adquirenteCodigo),
    [impacto.data, destinos],
  );
  const faltaDestino =
    precisaSubstituir && substituicoes.length < (impacto.data?.clientes.length ?? 0);

  const salvar = useMutation({
    mutationFn: async () => {
      const subs = precisaSubstituir ? substituicoes : undefined;
      const mudaSituacao = situacao !== det.data?.situacao;
      // Um código para todas as mutações deste save (vitrine, edição, situação, IPs, custo).
      const codigoTotp = await pedirCodigoTotp();
      if (!codigoTotp) {
        throw new Error('Código 2FA obrigatório para salvar a adquirente.');
      }
      // Vitrine primeiro: é ela que fecha o acesso e remaneja quem ficaria órfão.
      await api(`/admin/adquirentes/${codigo}/vitrine`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          nomeFantasia: nomeFantasia || undefined,
          temMed,
          observacaoCliente: observacao || undefined,
          disponibilidadePixEntrada: disponibilidade,
          substituicoes: subs,
          codigoTotp,
        }),
      });
      await api(`/admin/adquirentes/${codigo}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({
          nome,
          permitePixEntrada: entrada,
          permitePixSaida: saida,
          substituicoes: subs,
          codigoTotp,
        }),
      });
      if (mudaSituacao) {
        await api(`/admin/provedores/${codigo}/situacao`, {
          token,
          method: 'PUT',
          body: JSON.stringify({
            situacao,
            substituicoes: subs,
            codigoTotp,
          }),
        });
      }
      await api(`/admin/adquirentes/${codigo}/ips-webhook`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ ips: ipsWebhook, codigoTotp }),
      });
      for (const c of contas) {
        await api(`/admin/adquirentes/contas/${c.id}/custo`, {
          token,
          method: 'PUT',
          body: JSON.stringify({ ...c.custo, codigoTotp }),
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
    <Modal open={!!codigo} onClose={onClose} title="Editar adquirente" largura="lg">
      {det.isLoading ? (
        <p className="text-sm opacity-60">Carregando…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Um passo antes de salvar: se a mudança derruba clientes, mostra o
            // painel de substituição em vez de deixar a confirmação passar.
            if (precisaSubstituir && !exigeSubstituicao) {
              setExigeSubstituicao(true);
              return;
            }
            salvar.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <TextoRotulo obrigatorio>Nome interno</TextoRotulo>
              <input
                className={campo}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </label>
            <div>
              <p className="text-xs font-medium opacity-70">Situação</p>
              <div className="mt-1">
                <SeletorSituacao
                  value={situacao}
                  onChange={(v) => setSituacao(v as Situacao)}
                  opcoes={SITUACOES}
                />
              </div>
              <p className="mt-1 text-[11px] opacity-45">
                Inativa não atualiza transação nem saldo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Interruptor
              ligado={entrada}
              onChange={setEntrada}
              icone={<ArrowDownLeft className="h-4 w-4" strokeWidth={2} />}
              titulo="Cash-in"
              dica="Recebe PIX nesta adquirente"
            />
            <Interruptor
              ligado={saida}
              onChange={setSaida}
              icone={<ArrowUpRight className="h-4 w-4" strokeWidth={2} />}
              titulo="Cash-out"
              dica="Envia saque por esta adquirente"
            />
          </div>

          <Bloco
            icone={<Shield className="h-4 w-4" strokeWidth={2} />}
            titulo="IPs de webhook da liquidante"
            descricao="Camada 2: só estes endereços podem entregar o postback."
          >
            <CampoIpsWebhook ips={ipsWebhook} onChange={setIpsWebhook} />
          </Bloco>

          <Bloco
            icone={<Store className="h-4 w-4" strokeWidth={2} />}
            titulo="Vitrine do cliente"
            descricao="O que o lojista vê em /adquirentes ao escolher o PIX in."
          >
            <label className="block text-sm">
              Nome fantasia (exibido ao cliente)
              <input
                className={campo}
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder={nome}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={temMed}
                onChange={(e) => setTemMed(e.target.checked)}
                className="rounded border-ink-800/20 text-accent focus:ring-accent/30"
              />
              Tem MED
            </label>
            <label className="block text-sm">
              Observação ao cliente
              <textarea
                className={`${campo} min-h-[4.5rem] resize-y`}
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: liquidação em D+1, limite por transação de R$ 5.000…"
              />
            </label>
            <label className="block text-sm">
              Liberação do PIX in
              <select
                className={campo}
                value={disponibilidade}
                onChange={(e) => setDisponibilidade(e.target.value as Disponibilidade)}
              >
                <option value="TODOS">Todos os clientes</option>
                <option value="ESPECIFICOS">Somente clientes liberados</option>
              </select>
            </label>
          </Bloco>

          {contas.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-800/15 px-3 py-3 text-xs opacity-60 dark:border-white/15">
              Nenhuma conta configurada para esta adquirente.
            </p>
          )}
          {contas.map((c, idx) => (
            <Bloco
              key={c.id}
              icone={<Banknote className="h-4 w-4" strokeWidth={2} />}
              titulo={`Custo — ${c.nome}`}
              descricao="O que a adquirente cobra de nós (não é a taxa do lojista)."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5 dark:border-emerald-400/15">
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    PIX in
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoPercentual
                      label="% in"
                      valor={c.custo.custoPixEntradaPercentual}
                      onChange={(v) =>
                        setCusto(idx, 'custoPixEntradaPercentual', v)
                      }
                      className="!max-w-none"
                    />
                    <CampoMoeda
                      label="Fixo in"
                      valor={c.custo.custoPixEntradaFixo}
                      onChange={(v) => setCusto(idx, 'custoPixEntradaFixo', v)}
                      className="!max-w-none"
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] p-2.5 dark:border-rose-400/15">
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                    PIX out
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoPercentual
                      label="% out"
                      valor={c.custo.custoPixSaidaPercentual}
                      onChange={(v) => setCusto(idx, 'custoPixSaidaPercentual', v)}
                      className="!max-w-none"
                    />
                    <CampoMoeda
                      label="Fixo out"
                      valor={c.custo.custoPixSaidaFixo}
                      onChange={(v) => setCusto(idx, 'custoPixSaidaFixo', v)}
                      className="!max-w-none"
                    />
                  </div>
                </div>
              </div>
            </Bloco>
          ))}

          {exigeSubstituicao && impacto.data && (
            <PainelSubstituicao
              impacto={impacto.data}
              destinos={destinos}
              onDestino={(id, cod) => setDestinos((d) => ({ ...d, [id]: cod }))}
              onTodos={(cod) =>
                setDestinos(
                  Object.fromEntries(
                    (impacto.data?.clientes ?? []).map((c) => [c.idPublico, cod]),
                  ),
                )
              }
            />
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <ModalAcoes
            onCancelar={onClose}
            rotulo={precisaSubstituir && !exigeSubstituicao ? 'Continuar' : 'Salvar'}
            pendente={salvar.isPending}
            desabilitado={exigeSubstituicao && faltaDestino}
          />
        </form>
      )}
    </Modal>
  );
}

type ClienteLiberado = {
  idPublico: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  situacao: string;
  liberadoEm: string;
};

/** Clientes liberados nominalmente numa adquirente (quando ESPECIFICOS). */
export function ClientesAdquirenteModal({
  codigo,
  token,
  onClose,
}: {
  codigo: string | null;
  token: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ['adq-clientes', codigo, busca],
    enabled: !!codigo,
    queryFn: () =>
      api<{ total: number; disponibilidade: string; itens: ClienteLiberado[] }>(
        `/admin/adquirentes/${codigo}/clientes?limit=100&busca=${encodeURIComponent(busca)}`,
        { token },
      ),
  });

  const liberar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api(`/admin/adquirentes/${codigo}/clientes`, {
        token,
        method: 'POST',
        body: JSON.stringify({ usuarioIdPublico: novo.trim(), codigoTotp }),
      }),
    onSuccess: () => {
      setNovo('');
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['adq-clientes', codigo] });
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  const revogar = useMutation({
    mutationFn: (p: { idPublico: string; substituta?: string; codigoTotp: string }) =>
      api(
        `/admin/adquirentes/${codigo}/clientes/${p.idPublico}` +
          (p.substituta ? `?adquirenteSubstituta=${encodeURIComponent(p.substituta)}` : ''),
        {
          token,
          method: 'DELETE',
          body: JSON.stringify({ codigoTotp: p.codigoTotp }),
        },
      ),
    onSuccess: () => {
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['adq-clientes', codigo] });
    },
    onError: (e) => setErro(erroMsg(e)),
  });

  return (
    <Modal
      open={!!codigo}
      onClose={onClose}
      title="Clientes liberados"
      largura="lg"
    >
      <div className="space-y-4">
        {lista.data?.disponibilidade === 'TODOS' && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Esta adquirente está liberada para <strong>todos os clientes</strong>.
            A lista abaixo só vale se você mudar para “somente clientes liberados”.
          </p>
        )}

        <label className="block text-sm">
          Buscar cliente liberado
          <input
            className={campo}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, e-mail ou documento"
          />
        </label>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const codigoTotp = await pedirCodigoTotp();
            if (!codigoTotp) return;
            liberar.mutate(codigoTotp);
          }}
          className="flex items-end gap-2"
        >
          <label className="block flex-1 text-sm">
            <TextoRotulo obrigatorio>Liberar novo cliente (ID público)</TextoRotulo>
            <input
              className={campo}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="UUID do cliente"
              required
            />
          </label>
          <button
            type="submit"
            disabled={liberar.isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Liberar
          </button>
        </form>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {(lista.data?.itens ?? []).map((c) => (
            <li
              key={c.idPublico}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.nome}</p>
                <p className="truncate text-xs opacity-60">{c.email}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const resposta = await pedirTexto({
                    titulo: 'Remover liberação do cliente',
                    mensagem:
                      'Se este cliente estiver usando esta adquirente no PIX in, informe o código da adquirente substituta. Deixe vazio se não estiver.',
                    rotulo: 'Código da adquirente substituta (opcional)',
                    umaLinha: true,
                    maximo: 60,
                    perigo: true,
                    rotuloConfirmar: 'Remover liberação',
                  });
                  if (resposta === null) return;
                  const substituta = resposta;
                  const codigoTotp = await pedirCodigoTotp();
                  if (!codigoTotp) return;
                  revogar.mutate({
                    idPublico: c.idPublico,
                    substituta: substituta.trim() || undefined,
                    codigoTotp,
                  });
                }}
                className="rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium text-red-600"
              >
                Remover
              </button>
            </li>
          ))}
          {lista.data && lista.data.itens.length === 0 && (
            <li className="text-sm opacity-60">Nenhum cliente liberado.</li>
          )}
        </ul>
      </div>
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
  const [ipsWebhook, setIpsWebhook] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const criar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api('/admin/adquirentes', {
        token,
        method: 'POST',
        body: JSON.stringify({
          codigo,
          nome,
          permitePixEntrada: entrada,
          permitePixSaida: saida,
          ipsWebhook,
          codigoTotp,
        }),
      }),
    onSuccess: () => {
      setErro(null);
      setCodigo('');
      setNome('');
      setIpsWebhook([]);
      void qc.invalidateQueries({ queryKey: ['admin-adquirentes'] });
      onClose();
    },
    onError: (e) => setErro(erroMsg(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Nova adquirente">
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
          <TextoRotulo obrigatorio>Código</TextoRotulo>
          <input className={campo} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: sparc" required />
        </label>
        <label className="block text-sm">
          <TextoRotulo obrigatorio>Nome</TextoRotulo>
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
        <CampoIpsWebhook ips={ipsWebhook} onChange={setIpsWebhook} />
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Nasce INATIVA e liberada só para clientes específicos. Configure a
          conta/credenciais, preencha a vitrine e ative depois.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <ModalAcoes onCancelar={onClose} rotulo="Cadastrar" pendente={criar.isPending} />
      </form>
    </Modal>
  );
}
