'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { pedirTexto } from '@/lib/dialogos';
import { rotuloDocumento, tiposParaUploadAdmin } from '@/lib/documentos';
import { formatarDataHora } from '@/lib/fuso';
import {
  ACCEPT_DOCUMENTO,
  TEXTO_LIMITES_DOCUMENTO,
  mensagemErroArquivoDocumento,
} from '@/lib/upload-documento';

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

/** Tipo já coberto: PENDENTE (cliente enviou) ou VALIDO — não reenviar. INVALIDO libera. */
function tipoJaEnviado(
  documentos: DocumentoAdmin[] | undefined,
  tipo: string,
): boolean {
  return (documentos ?? []).some(
    (d) =>
      d.tipoDocumento === tipo &&
      (d.situacao === 'PENDENTE' || d.situacao === 'VALIDO'),
  );
}

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

/** Garante MIME no blob — resposta sem Content-Type vira download UUID sem extensão. */
async function blobDoArquivo(res: Response, doc: DocumentoAdmin): Promise<Blob> {
  const bruto = await res.blob();
  const tipo = bruto.type || doc.tipoMime || '';
  if (tipo && bruto.type !== tipo) return new Blob([bruto], { type: tipo });
  return bruto;
}

/** Abre o arquivo em nova aba; PDFs e imagens o browser renderiza inline. */
async function abrirEmNovaAba(doc: DocumentoAdmin, token: string) {
  const res = await fetch(`${API_URL}/admin/documentos/${doc.id}/arquivo`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await blobDoArquivo(res, doc));
  window.open(url, '_blank', 'noopener');
  // Revoga só depois de a aba ter carregado o blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function baixar(doc: DocumentoAdmin, token: string) {
  const res = await fetch(`${API_URL}/admin/documentos/${doc.id}/arquivo`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await blobDoArquivo(res, doc));
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
  tipoPessoa,
  permitirUpload = true,
}: {
  idPublico: string;
  token: string;
  /** false deixa a lista somente-leitura; omitido, segue o perfil de acesso. */
  podeValidar?: boolean;
  /** Chamado após validar/invalidar, para a tela refrescar seus contadores. */
  onAtualizar?: () => void;
  /** Decide se os documentos societários entram no seletor de upload. */
  tipoPessoa?: 'PF' | 'PJ';
  /** false esconde o envio pelo admin (lista puramente de consulta). */
  permitirUpload?: boolean;
}) {
  const { pode } = useAuth();
  const validavel = podeValidar ?? pode(PERMISSOES.ADMIN_APROVACOES_APROVAR);
  const qc = useQueryClient();
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const catalogoTipos = useMemo(
    () => tiposParaUploadAdmin(tipoPessoa ?? 'PF'),
    [tipoPessoa],
  );
  const [tipoEscolhido, setTipoEscolhido] = useState<string>(catalogoTipos[0]);

  const docs = useQuery({
    queryKey: ['admin-docs', idPublico],
    queryFn: () =>
      api<{ documentos: DocumentoAdmin[] }>(
        `/admin/usuarios/${idPublico}/documentos`,
        { token },
      ),
  });

  const tiposDisponiveis = useMemo(
    () => catalogoTipos.filter((t) => !tipoJaEnviado(docs.data?.documentos, t)),
    [catalogoTipos, docs.data?.documentos],
  );

  useEffect(() => {
    if (tiposDisponiveis.length === 0) return;
    if (!tiposDisponiveis.includes(tipoEscolhido as (typeof tiposDisponiveis)[number])) {
      setTipoEscolhido(tiposDisponiveis[0]);
    }
  }, [tiposDisponiveis, tipoEscolhido]);

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

  /**
   * Envio pela VPay: usado quando o cliente não manda a documentação e ela chega
   * por outro canal (e-mail, WhatsApp, presencial). Vai como `multipart/form-data`
   * direto no `fetch` — o helper `api()` serializa JSON e não serve aqui.
   *
   * O documento nasce VALIDO no servidor, validado por quem subiu: quem tem o
   * arquivo na mão e a permissão de aprovar já conferiu — mandar para a própria
   * fila de validação seria pedir que a pessoa se aprovasse depois.
   */
  async function enviarArquivo(arquivo: File) {
    setErroUpload(null);
    if (!tiposDisponiveis.includes(tipoEscolhido as (typeof tiposDisponiveis)[number])) {
      setErroUpload(
        'Este tipo já foi enviado (pendente ou válido). Invalide o documento atual para reenviar.',
      );
      return;
    }
    const rejeicao = mensagemErroArquivoDocumento(arquivo);
    if (rejeicao) {
      setErroUpload(rejeicao);
      return;
    }
    const codigoTotp = await pedirCodigoTotp(
      'Confirme o envio do documento com o código 2FA da sua conta admin:',
    );
    if (!codigoTotp) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('tipoDocumento', tipoEscolhido);
      fd.append('arquivo', arquivo);
      fd.append('codigoTotp', codigoTotp);
      const res = await fetch(`${API_URL}/admin/usuarios/${idPublico}/documentos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      void qc.invalidateQueries({ queryKey: ['admin-docs', idPublico] });
      onAtualizar?.();
    } catch (e) {
      setErroUpload(e instanceof Error ? e.message : 'Falha ao enviar o documento.');
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar =
    validavel && permitirUpload && tiposDisponiveis.length > 0 && !enviando;

  const blocoEnvio =
    validavel && permitirUpload ? (
      <div className="mt-3 rounded-md border border-dashed border-ink-800/20 p-3 dark:border-white/15">
        <p className="text-xs font-medium">Enviar documento pela VPay</p>
        <p className="mt-0.5 text-[11px] opacity-60">
          Use quando a documentação chegar por fora do painel. Entra já como
          válida, no seu nome. O contrato de prestação de serviço é só da VPay
          (após assinatura) e não é exigido para aprovar a conta.{' '}
          {TEXTO_LIMITES_DOCUMENTO}.
        </p>
        {tiposDisponiveis.length === 0 ? (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
            Todos os tipos já foram enviados (pendente ou válido). Para
            substituir, marque o atual como inválido.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={tipoEscolhido}
              onChange={(ev) => setTipoEscolhido(ev.target.value)}
              disabled={!podeEnviar}
              className="w-full rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-xs text-ink-950 outline-none [color-scheme:light] focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-white/15 dark:bg-ink-950 dark:text-white dark:[color-scheme:dark]"
            >
              {tiposDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {rotuloDocumento(t)}
                </option>
              ))}
            </select>
            <label
              className={`inline-block rounded-md border border-accent px-3 py-1.5 text-center text-xs font-medium text-accent transition ${
                podeEnviar
                  ? 'cursor-pointer hover:bg-accent/10'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              {enviando ? 'Enviando…' : 'Escolher arquivo e enviar'}
              <input
                type="file"
                accept={ACCEPT_DOCUMENTO}
                className="hidden"
                disabled={!podeEnviar}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  // Limpa antes do await: sem isso, reenviar o MESMO arquivo depois
                  // de um erro não dispara `change` de novo e a tela trava.
                  ev.target.value = '';
                  if (f) void enviarArquivo(f);
                }}
              />
            </label>
          </div>
        )}
        {erroUpload && <p className="mt-2 text-xs text-red-600">{erroUpload}</p>}
      </div>
    ) : null;

  if (docs.isLoading) return <p className="text-xs opacity-60">Carregando documentos…</p>;
  if (docs.isError)
    return <p className="text-xs text-red-600">Falha ao carregar os documentos.</p>;
  if (!docs.data?.documentos.length)
    return (
      <>
        <p className="text-xs opacity-60">Nenhum documento enviado.</p>
        {blocoEnvio}
      </>
    );

  return (
    <>
    <ul className="space-y-2">
      {docs.data.documentos.map((d) => (
        <li
          key={d.id}
          className="rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              {/* Mesmo rótulo do seletor de envio logo abaixo — deixar o enum
                  cru aqui e o nome amigável ali confundiria as duas metades do
                  mesmo card. */}
              <p className="font-medium">{rotuloDocumento(d.tipoDocumento)}</p>
              <p className="truncate text-xs opacity-60">
                {d.nomeArquivo}
                {tamanho(d.tamanhoBytes) ? ` · ${tamanho(d.tamanhoBytes)}` : ''} · enviado
                em {formatarDataHora(d.enviadoEm)}
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
                    onClick={async () => {
                      const codigoTotp = await pedirCodigoTotp();
                      if (!codigoTotp) return;
                      validar.mutate({ id: d.id, situacao: 'VALIDO', codigoTotp });
                    }}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    Válido
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const resposta = await pedirTexto({
                        titulo: 'Invalidar documento',
                        mensagem:
                          'O motivo aparece para o cliente no reenvio do documento.',
                        rotulo: 'Motivo (opcional)',
                        maximo: 500,
                        perigo: true,
                        rotuloConfirmar: 'Invalidar',
                      });
                      if (resposta === null) return;
                      const motivo = resposta || undefined;
                      const codigoTotp = await pedirCodigoTotp();
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
    {blocoEnvio}
    </>
  );
}
