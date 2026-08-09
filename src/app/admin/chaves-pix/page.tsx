'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, History } from 'lucide-react';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, TabelaPaginada, type Coluna } from '@/components/tabela';
import { Modal, ModalAcoes } from '@/components/modal';
import { IdadeSolicitacao } from '@/components/status';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

type Historico = {
  situacaoAnterior: string;
  novaSituacao: string;
  motivo: string | null;
  ator: string | null;
  origem: string;
  criadoEm: string;
};

type ChavePix = {
  idPublico: string;
  apelido: string | null;
  chave: string;
  tipoChave: string;
  nomeTitular: string | null;
  situacao: string;
  motivoReprovacao: string | null;
  criadoEm: string;
  cliente: { idPublico: string; nome: string; cpfCnpj: string; situacao: string };
  /** A chave já passou por uma decisão antes: é reentrada na fila, não pedido novo. */
  recadastro: boolean;
  historico: Historico[];
  /** Mesma chave viva em OUTRAS contas (o cliente pode ter mais de uma empresa). */
  outrasContas: Array<{ nome: string; cpfCnpj: string; situacao: string }>;
};

/**
 * Diferente de Aprovações, aqui a fila tem UMA situação pendente só
 * (`PENDENTE`) — não há duas etapas de espera para juntar. O que faltava era o
 * mesmo que faltava lá: enxergar HÁ QUANTO TEMPO a solicitação está parada.
 */
const FILTROS = [
  { chave: 'PENDENTE', label: 'Pendências' },
  { chave: 'APROVADA', label: 'Aprovadas' },
  { chave: 'REPROVADA', label: 'Reprovadas' },
  { chave: 'REVOGADA', label: 'Revogadas' },
] as const;

const badge: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  APROVADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  REPROVADA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  REVOGADA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  INATIVA: 'bg-ink-800/10 text-ink-900 dark:bg-white/10 dark:text-white',
};

const ROTULO_ACAO = {
  REPROVADA: {
    titulo: 'Reprovar chave PIX',
    rotulo: 'Reprovar',
    ajuda: 'O cliente recebe este motivo por e-mail e vê no painel.',
  },
  REVOGADA: {
    titulo: 'Desativar chave PIX aprovada',
    rotulo: 'Desativar chave',
    ajuda:
      'A chave deixa de valer para saque imediatamente, inclusive para saques em processamento. O cliente recebe este motivo por e-mail.',
  },
} as const;

type Acao = keyof typeof ROTULO_ACAO;

/**
 * Justificativa em modal, não em `window.prompt`: o prompt do navegador não
 * valida tamanho, não explica o efeito da ação e foge do padrão de rodapé do
 * sistema (Cancelar à esquerda, confirmar à direita).
 */
function ModalJustificativa({
  alvo,
  onCancelar,
  onConfirmar,
  pendente,
}: {
  alvo: { chave: ChavePix; acao: Acao } | null;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
  pendente: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  if (!alvo) return null;
  const cfg = ROTULO_ACAO[alvo.acao];
  const valido = motivo.trim().length >= 5;

  return (
    <Modal
      open
      onClose={() => {
        setMotivo('');
        onCancelar();
      }}
      title={cfg.titulo}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          onConfirmar(motivo.trim());
          setMotivo('');
        }}
        className="space-y-4"
      >
        <div className="rounded-md border border-ink-800/10 p-3 text-sm dark:border-white/10">
          <p className="font-medium">{alvo.chave.cliente.nome}</p>
          <p className="font-mono text-xs opacity-70">{alvo.chave.chave}</p>
        </div>

        <label className="block text-sm">
          Justificativa <span className="text-red-600">*</span>
          <textarea
            autoFocus
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder="Ex.: titular divergente da documentação do cadastro"
            className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900"
          />
          <span className="text-xs opacity-60">{cfg.ajuda}</span>
        </label>

        <ModalAcoes
          onCancelar={() => {
            setMotivo('');
            onCancelar();
          }}
          rotulo={cfg.rotulo}
          pendente={pendente}
          desabilitado={!valido}
        />
      </form>
    </Modal>
  );
}

/** Avisos que mudam a decisão do analista: reentrada na fila e chave repetida. */
function AlertasDaChave({ c }: { c: ChavePix }) {
  const decisoesAnteriores = c.historico.filter(
    (h) => h.novaSituacao !== 'PENDENTE',
  );
  if (!c.recadastro && !c.outrasContas.length) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {c.recadastro && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <History className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Chave cadastrada novamente
          </p>
          {decisoesAnteriores.slice(0, 2).map((h, i) => (
            <p key={i} className="mt-0.5 opacity-80">
              {new Date(h.criadoEm).toLocaleDateString('pt-BR')} · {h.novaSituacao}
              {h.motivo ? ` — ${h.motivo}` : ''}
              {h.ator ? ` (${h.ator})` : ''}
            </p>
          ))}
        </div>
      )}
      {c.outrasContas.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Mesma chave em {c.outrasContas.length} outra
            {c.outrasContas.length > 1 ? 's contas' : ' conta'}
          </p>
          {c.outrasContas.map((o, i) => (
            <p key={i} className="mt-0.5 opacity-80">
              {o.nome} · {formatarDocumento(o.cpfCnpj)} · {o.situacao}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminChavesPixPage() {
  const { token, pode } = useAuth();
  const podeAprovar = pode(PERMISSOES.ADMIN_CHAVES_PIX_APROVAR);
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<string>('PENDENTE');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ chave: ChavePix; acao: Acao } | null>(null);

  const chaves = useQuery({
    queryKey: ['admin-chaves-pix', situacao],
    enabled: !!token,
    queryFn: () =>
      api<ChavePix[]>(`/admin/chaves-pix?situacao=${situacao}`, { token: token! }),
  });

  const aoDecidir = {
    onSuccess: () => {
      setErro(null);
      setAlvo(null);
      void qc.invalidateQueries({ queryKey: ['admin-chaves-pix'] });
      // Badge de pendências do menu lateral reflete a decisão na hora.
      void qc.invalidateQueries({ queryKey: ['admin-pendencias'] });
    },
    onError: (e: unknown) =>
      setErro(e instanceof Error ? e.message : 'Falha na decisão'),
  };

  const decidir = useMutation({
    mutationFn: (p: {
      id: string;
      situacao: 'APROVADA' | 'REPROVADA';
      motivo?: string;
      codigoTotp: string;
    }) =>
      api(`/admin/chaves-pix/${p.id}/decidir`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({
          situacao: p.situacao,
          motivo: p.motivo,
          codigoTotp: p.codigoTotp,
        }),
      }),
    ...aoDecidir,
  });

  const revogar = useMutation({
    mutationFn: (p: { id: string; motivo: string; codigoTotp: string }) =>
      api(`/admin/chaves-pix/${p.id}/revogar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ motivo: p.motivo, codigoTotp: p.codigoTotp }),
      }),
    ...aoDecidir,
  });

  const dados = useMemo(() => {
    const lista = chaves.data ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (c) =>
        c.chave.toLowerCase().includes(q) ||
        c.cliente.nome.toLowerCase().includes(q),
    );
  }, [chaves.data, busca]);

  const confirmarJustificativa = (motivo: string) => {
    if (!alvo) return;
    const codigoTotp = pedirCodigoTotp();
    if (!codigoTotp) return;
    if (alvo.acao === 'REVOGADA') {
      revogar.mutate({ id: alvo.chave.idPublico, motivo, codigoTotp });
    } else {
      decidir.mutate({
        id: alvo.chave.idPublico,
        situacao: 'REPROVADA',
        motivo,
        codigoTotp,
      });
    }
  };

  const colunas: Coluna<ChavePix>[] = [
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium">{c.cliente.nome}</p>
          <p className="text-xs opacity-60">{formatarDocumento(c.cliente.cpfCnpj)}</p>
          <p className="text-xs opacity-60">
            Solicitado em {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
            {' · '}
            <IdadeSolicitacao desde={c.criadoEm} />
          </p>
          <AlertasDaChave c={c} />
        </div>
      ),
    },
    {
      chave: 'chave',
      titulo: 'Chave',
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{c.chave}</p>
          {c.apelido && <p className="text-xs opacity-60">{c.apelido}</p>}
          {c.nomeTitular && (
            <p className="text-xs opacity-70">Titular: {c.nomeTitular}</p>
          )}
        </div>
      ),
    },
    { chave: 'tipoChave', titulo: 'Tipo' },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (c) => (
        <div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[c.situacao] ?? ''}`}
          >
            {c.situacao}
          </span>
          {c.motivoReprovacao && (
            <p className="mt-1 max-w-[16rem] text-xs text-red-600 dark:text-red-400">
              {c.motivoReprovacao}
            </p>
          )}
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (c) => {
        if (!podeAprovar) return <span className="text-xs opacity-40">—</span>;
        const ocupado = decidir.isPending || revogar.isPending;

        if (c.situacao === 'PENDENTE') {
          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  const codigoTotp = pedirCodigoTotp();
                  if (!codigoTotp) return;
                  decidir.mutate({
                    id: c.idPublico,
                    situacao: 'APROVADA',
                    codigoTotp,
                  });
                }}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setAlvo({ chave: c, acao: 'REPROVADA' })}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                Reprovar
              </button>
            </div>
          );
        }

        // Chave aprovada pode ser cortada a qualquer momento: é o freio de mão
        // de quem administra quando algo acontece com a conta ou com a chave.
        if (c.situacao === 'APROVADA') {
          return (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setAlvo({ chave: c, acao: 'REVOGADA' })}
              className="rounded border border-red-500/60 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
            >
              Desativar
            </button>
          );
        }
        return <span className="text-xs opacity-40">—</span>;
      },
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Chaves PIX</h1>
      <p className="mt-1 text-sm opacity-70">
        Saque pelo painel só é liberado com chave aprovada. Confira o titular
        contra a documentação do cadastro antes de aprovar.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            type="button"
            onClick={() => setSituacao(f.chave)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              situacao === f.chave
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-ink-800/15 opacity-70 dark:border-white/15'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-6">
        <BarraFiltros>
          <FiltroTexto
            label="Buscar"
            value={busca}
            onChange={setBusca}
            placeholder="Chave ou razão social"
          />
        </BarraFiltros>

        <TabelaPaginada<ChavePix>
          colunas={colunas}
          dados={dados}
          chave={(c) => c.idPublico}
          carregando={chaves.isLoading}
          tamanhoPagina={10}
          seletorTamanho
          vazio={`Nenhuma chave com situação ${situacao}.`}
        />
      </div>

      <ModalJustificativa
        alvo={alvo}
        onCancelar={() => setAlvo(null)}
        onConfirmar={confirmarJustificativa}
        pendente={decidir.isPending || revogar.isPending}
      />
    </Shell>
  );
}
