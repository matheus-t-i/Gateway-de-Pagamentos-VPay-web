'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

export type DocumentoAdmin = {
  id: string;
  tipoDocumento: string;
  nomeArquivo: string;
  tipoMime: string | null;
  tamanhoBytes: number | null;
  situacao: string;
  motivoInvalidacao: string | null;
  enviadoEm: string;
  validadoEm: string | null;
};

export const badgeDocumento: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  EM_ANALISE: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  VALIDO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  ATIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  ATIVA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  INVALIDO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  REPROVADO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  REPROVADA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

/** Abre o arquivo em nova aba; PDFs e imagens o browser renderiza inline. */
async function abrirEmNovaAba(doc: DocumentoAdmin, token: string) {
  const res = await fetch(`${API_URL}/admin/documentos/${doc.id}/arquivo`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener');
  // Revoga só depois de a aba ter carregado o blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function baixar(doc: DocumentoAdmin, token: string) {
  const res = await fetch(`${API_URL}/admin/documentos/${doc.id}/arquivo`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function tamanho(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lista os documentos da conta com visualização, download e (opcionalmente)
 * validação. Compartilhado entre Aprovações e a ficha do cliente em
 * /admin/usuarios/[idPublico] — a chave de cache é a mesma nas duas telas,
 * então validar em uma refresca a outra.
 */
export function DocumentosAdmin({
  idPublico,
  token,
  podeValidar,
  onAtualizar,
}: {
  idPublico: string;
  token: string;
  /** false deixa a lista somente-leitura; omitido, segue o perfil de acesso. */
  podeValidar?: boolean;
  /** Chamado após validar/invalidar, para a tela refrescar seus contadores. */
  onAtualizar?: () => void;
}) {
  const { pode } = useAuth();
  const validavel = podeValidar ?? pode(PERMISSOES.ADMIN_APROVACOES_APROVAR);
  const qc = useQueryClient();

  const docs = useQuery({
    queryKey: ['admin-docs', idPublico],
    queryFn: () =>
      api<{ documentos: DocumentoAdmin[] }>(
        `/admin/usuarios/${idPublico}/documentos`,
        { token },
      ),
  });

  const validar = useMutation({
    mutationFn: (p: {
      id: string;
      situacao: 'VALIDO' | 'INVALIDO';
      motivo?: string;
      codigoTotp: string;
    }) =>
      api(`/admin/documentos/${p.id}/validar`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          situacao: p.situacao,
          motivo: p.motivo,
          codigoTotp: p.codigoTotp,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-docs', idPublico] });
      onAtualizar?.();
    },
  });

  if (docs.isLoading) return <p className="text-xs opacity-60">Carregando documentos…</p>;
  if (docs.isError)
    return <p className="text-xs text-red-600">Falha ao carregar os documentos.</p>;
  if (!docs.data?.documentos.length)
    return <p className="text-xs opacity-60">Nenhum documento enviado.</p>;

  return (
    <ul className="space-y-2">
      {docs.data.documentos.map((d) => (
        <li
          key={d.id}
          className="rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{d.tipoDocumento}</p>
              <p className="truncate text-xs opacity-60">
                {d.nomeArquivo}
                {tamanho(d.tamanhoBytes) ? ` · ${tamanho(d.tamanhoBytes)}` : ''} · enviado
                em {new Date(d.enviadoEm).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeDocumento[d.situacao] ?? ''}`}>
                {d.situacao}
              </span>
              <button
                type="button"
                onClick={() => void abrirEmNovaAba(d, token)}
                className="text-xs text-accent underline"
              >
                Visualizar
              </button>
              <button
                type="button"
                onClick={() => void baixar(d, token)}
                className="text-xs text-accent underline"
              >
                Baixar
              </button>
              {validavel && d.situacao === 'PENDENTE' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const codigoTotp = pedirCodigoTotp();
                      if (!codigoTotp) return;
                      validar.mutate({ id: d.id, situacao: 'VALIDO', codigoTotp });
                    }}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    Válido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const motivo = window.prompt('Motivo da invalidação:') ?? undefined;
                      if (motivo === undefined) return;
                      const codigoTotp = pedirCodigoTotp();
                      if (!codigoTotp) return;
                      validar.mutate({
                        id: d.id,
                        situacao: 'INVALIDO',
                        motivo,
                        codigoTotp,
                      });
                    }}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    Inválido
                  </button>
                </>
              )}
            </div>
          </div>
          {d.motivoInvalidacao && (
            <p className="mt-1 text-xs text-red-600">Motivo: {d.motivoInvalidacao}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
