'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';

type UsuarioAdmin = {
  idPublico: string;
  nomeRazaoSocial: string;
  email: string;
  cpfCnpj: string;
  tipoPessoa: 'PF' | 'PJ';
  responsavel: { cpf: string | null; nome: string | null };
  situacao: string;
  criadoEm: string;
  documentos: { total: number; pendentes: number; validos: number; invalidos: number };
  empresas: Array<{ idPublico: string; razaoSocial: string; situacao: string }>;
};

type DocAdmin = {
  id: string;
  tipoDocumento: string;
  nomeArquivo: string;
  situacao: string;
  motivoInvalidacao: string | null;
  enviadoEm: string;
};

const SITUACOES = ['EM_ANALISE', 'PENDENTE', 'ATIVO', 'REPROVADO'] as const;

const badge: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  EM_ANALISE: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  VALIDO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  ATIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  ATIVA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  INVALIDO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  REPROVADO: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  REPROVADA: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

function DocumentosDe({
  escopo,
  idPublico,
  token,
}: {
  escopo: 'usuario' | 'empresa';
  idPublico: string;
  token: string;
}) {
  const qc = useQueryClient();
  const rota = escopo === 'usuario' ? 'usuarios' : 'empresas';
  const docs = useQuery({
    queryKey: ['admin-docs', escopo, idPublico],
    queryFn: () =>
      api<{ documentos: DocAdmin[] }>(`/admin/${rota}/${idPublico}/documentos`, {
        token,
      }),
  });

  const validar = useMutation({
    mutationFn: (p: { id: string; situacao: 'VALIDO' | 'INVALIDO'; motivo?: string }) =>
      api(`/admin/documentos/${escopo}/${p.id}/validar`, {
        token,
        method: 'POST',
        body: JSON.stringify({ situacao: p.situacao, motivo: p.motivo }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['admin-docs', escopo, idPublico] }),
  });

  async function baixar(doc: DocAdmin) {
    const res = await fetch(`${API_URL}/admin/documentos/${escopo}/${doc.id}/arquivo`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!docs.data) return <p className="text-xs opacity-60">Carregando documentos…</p>;
  if (docs.data.documentos.length === 0)
    return <p className="text-xs opacity-60">Nenhum documento enviado.</p>;

  return (
    <ul className="space-y-2">
      {docs.data.documentos.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-800/10 px-3 py-2 text-sm dark:border-white/10"
        >
          <div className="min-w-0">
            <p className="font-medium">{d.tipoDocumento}</p>
            <p className="truncate text-xs opacity-60">{d.nomeArquivo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${badge[d.situacao] ?? ''}`}>
              {d.situacao}
            </span>
            <button
              type="button"
              onClick={() => void baixar(d)}
              className="text-xs text-accent underline"
            >
              Baixar
            </button>
            {d.situacao === 'PENDENTE' && (
              <>
                <button
                  type="button"
                  onClick={() => validar.mutate({ id: d.id, situacao: 'VALIDO' })}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                >
                  Válido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const motivo = window.prompt('Motivo da invalidação:') ?? undefined;
                    if (motivo !== undefined) {
                      validar.mutate({ id: d.id, situacao: 'INVALIDO', motivo });
                    }
                  }}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                >
                  Inválido
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AprovacoesPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<(typeof SITUACOES)[number]>('EM_ANALISE');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(10);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const usuarios = useQuery({
    queryKey: ['admin-usuarios', situacao],
    enabled: !!token,
    queryFn: () =>
      api<UsuarioAdmin[]>(`/admin/usuarios?situacao=${situacao}`, { token: token! }),
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = usuarios.data ?? [];
    if (!q) return lista;
    return lista.filter(
      (u) =>
        u.nomeRazaoSocial.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [usuarios.data, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * tamanho,
    paginaAtual * tamanho,
  );

  // Volta à primeira página quando muda a aba de status ou a busca.
  useEffect(() => {
    setPagina(1);
  }, [situacao, busca]);

  const invalidate = () => {
    setErro(null);
    void qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
  };
  const onErro = (e: unknown) =>
    setErro(e instanceof Error ? e.message : 'Operação falhou');

  const ativarUsuario = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/usuarios/${id}/ativar`, { token: token!, method: 'POST' }),
    onSuccess: invalidate,
    onError: onErro,
  });
  const reprovarUsuario = useMutation({
    mutationFn: (p: { id: string; motivo: string }) =>
      api(`/admin/usuarios/${p.id}/reprovar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ motivo: p.motivo }),
      }),
    onSuccess: invalidate,
    onError: onErro,
  });
  const ativarEmpresa = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/empresas/${id}/ativar`, { token: token!, method: 'POST' }),
    onSuccess: invalidate,
    onError: onErro,
  });
  const reprovarEmpresa = useMutation({
    mutationFn: (p: { id: string; motivo: string }) =>
      api(`/admin/empresas/${p.id}/reprovar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ motivo: p.motivo }),
      }),
    onSuccess: invalidate,
    onError: onErro,
  });

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Aprovações</h1>
      <p className="mt-1 text-sm opacity-70">
        Análise de cadastros: revise a documentação e aprove ou reprove.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {SITUACOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSituacao(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              situacao === s
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-ink-800/15 opacity-70 dark:border-white/15'
            }`}
          >
            {s}
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
            placeholder="Nome ou e-mail"
          />
        </BarraFiltros>
      </div>

      <ul className="space-y-3">
        {visiveis.map((u) => (
          <li
            key={u.idPublico}
            className="rounded-lg border border-ink-800/10 p-4 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {u.nomeRazaoSocial}{' '}
                  <span className="ml-1 rounded bg-ink-800/10 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/10">
                    {u.tipoPessoa}
                  </span>
                </p>
                <p className="truncate text-xs opacity-60">
                  {u.email} · {formatarDocumento(u.cpfCnpj)}
                </p>
                {u.tipoPessoa === 'PJ' && u.responsavel?.cpf && (
                  <p className="truncate text-xs opacity-60">
                    Responsável: {u.responsavel.nome} ·{' '}
                    {formatarDocumento(u.responsavel.cpf)}
                  </p>
                )}
                <p className="mt-1 text-xs opacity-50">
                  Docs: {u.documentos.validos} válidos · {u.documentos.pendentes}{' '}
                  pendentes · {u.documentos.invalidos} inválidos
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge[u.situacao] ?? ''}`}>
                  {u.situacao}
                </span>
                <button
                  type="button"
                  onClick={() => setAberto(aberto === u.idPublico ? null : u.idPublico)}
                  className="text-xs text-accent underline"
                >
                  {aberto === u.idPublico ? 'Fechar' : 'Revisar'}
                </button>
              </div>
            </div>

            {aberto === u.idPublico && token && (
              <div className="mt-4 space-y-5 border-t border-ink-800/10 pt-4 dark:border-white/10">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">
                    {u.tipoPessoa === 'PJ'
                      ? 'Documentos do responsável'
                      : 'Documentos do titular'}
                  </h3>
                  <DocumentosDe escopo="usuario" idPublico={u.idPublico} token={token} />
                  {/* Upload do contrato de prestação de serviço assinado (VPay) */}
                  <label className="mt-3 inline-block cursor-pointer rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10">
                    Subir contrato de prestação de serviço
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        ev.target.value = '';
                        if (!f || !token) return;
                        try {
                          const fd = new FormData();
                          fd.append('tipoDocumento', 'CONTRATO_PRESTACAO_SERVICO');
                          fd.append('arquivo', f);
                          const res = await fetch(
                            `${API_URL}/admin/usuarios/${u.idPublico}/documentos`,
                            {
                              method: 'POST',
                              headers: { authorization: `Bearer ${token}` },
                              body: fd,
                            },
                          );
                          if (!res.ok) throw new Error(await res.text());
                          void qc.invalidateQueries({
                            queryKey: ['admin-docs', 'usuario', u.idPublico],
                          });
                        } catch (e) {
                          onErro(e);
                        }
                      }}
                    />
                  </label>
                  {u.situacao === 'EM_ANALISE' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => ativarUsuario.mutate(u.idPublico)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Aprovar usuário
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const motivo = window.prompt('Motivo da reprovação:');
                          if (motivo) reprovarUsuario.mutate({ id: u.idPublico, motivo });
                        }}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Reprovar usuário
                      </button>
                    </div>
                  )}
                </div>

                {u.empresas.map((e) => (
                  <div key={e.idPublico}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">
                      Empresa: {e.razaoSocial}{' '}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${badge[e.situacao] ?? ''}`}>
                        {e.situacao}
                      </span>
                    </h3>
                    <DocumentosDe escopo="empresa" idPublico={e.idPublico} token={token} />
                    {e.situacao === 'EM_ANALISE' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => ativarEmpresa.mutate(e.idPublico)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Aprovar empresa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const motivo = window.prompt('Motivo da reprovação:');
                            if (motivo) reprovarEmpresa.mutate({ id: e.idPublico, motivo });
                          }}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Reprovar empresa
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-800/20 p-6 text-center text-sm opacity-70 dark:border-white/20">
            {busca.trim()
              ? `Nenhum cadastro corresponde à busca "${busca.trim()}".`
              : `Nenhum cadastro com situação ${situacao}.`}
          </li>
        )}
      </ul>

      {filtrados.length > 0 && (
        <div className="mt-4 rounded-lg border border-ink-800/10 dark:border-white/10">
          <Paginacao
            pagina={paginaAtual}
            totalPaginas={totalPaginas}
            total={filtrados.length}
            onPagina={setPagina}
            seletor={
              <SeletorPorPagina
                value={tamanho}
                onChange={(novo) => {
                  setTamanho(novo);
                  setPagina(1);
                }}
              />
            }
          />
        </div>
      )}
    </Shell>
  );
}
