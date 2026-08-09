'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { badgeDocumento as badge, DocumentosAdmin } from '@/components/documentos-admin';
import { IdadeSolicitacao } from '@/components/status';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';

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
};

/**
 * PENDENTE (aguardando o cliente enviar documento) e EM_ANALISE (aguardando o
 * admin decidir) são as duas situações que ainda precisam de alguma ação —
 * ficam juntas na aba "Pendências" para quem abre a tela ver a fila inteira,
 * não só metade dela. ATIVO/REPROVADO são desfecho: histórico, não fila.
 */
const ABAS = [
  { chave: 'PENDENCIAS', label: 'Pendências', situacoes: ['PENDENTE', 'EM_ANALISE'] },
  { chave: 'ATIVO', label: 'Ativos', situacoes: ['ATIVO'] },
  { chave: 'REPROVADO', label: 'Reprovados', situacoes: ['REPROVADO'] },
] as const;

export default function AprovacoesPage() {
  const { token, pode } = useAuth();
  const podeAprovar = pode(PERMISSOES.ADMIN_APROVACOES_APROVAR);
  const qc = useQueryClient();
  const [aba, setAba] = useState<(typeof ABAS)[number]['chave']>('PENDENCIAS');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(10);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abaAtual = ABAS.find((a) => a.chave === aba)!;
  const naFilaPendencias = aba === 'PENDENCIAS';

  const usuarios = useQuery({
    queryKey: ['admin-usuarios', aba],
    enabled: !!token,
    queryFn: () =>
      api<UsuarioAdmin[]>(
        `/admin/usuarios?situacao=${abaAtual.situacoes.join(',')}`,
        { token: token! },
      ),
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = usuarios.data ?? [];
    if (q) {
      lista = lista.filter(
        (u) =>
          u.nomeRazaoSocial.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    // Na fila de pendências, quem chegou primeiro aparece primeiro — é a ordem
    // natural de atendimento; nas abas de desfecho o mais recente no topo
    // (auditoria) já vem certo da API.
    return naFilaPendencias
      ? [...lista].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
      : lista;
  }, [usuarios.data, busca, naFilaPendencias]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * tamanho,
    paginaAtual * tamanho,
  );

  // Volta à primeira página quando muda a aba de status ou a busca.
  useEffect(() => {
    setPagina(1);
  }, [aba, busca]);

  const invalidate = () => {
    setErro(null);
    void qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
    // Badge de pendências do menu lateral reflete a decisão na hora.
    void qc.invalidateQueries({ queryKey: ['admin-pendencias'] });
  };
  const onErro = (e: unknown) =>
    setErro(e instanceof Error ? e.message : 'Operação falhou');

  const ativarUsuario = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api(`/admin/usuarios/${p.id}/ativar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: invalidate,
    onError: onErro,
  });
  const reprovarUsuario = useMutation({
    mutationFn: (p: { id: string; motivo: string; codigoTotp: string }) =>
      api(`/admin/usuarios/${p.id}/reprovar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ motivo: p.motivo, codigoTotp: p.codigoTotp }),
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
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              aba === a.chave
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-ink-800/15 opacity-70 dark:border-white/15'
            }`}
          >
            {a.label}
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
                <p className="mt-0.5 text-xs opacity-60">
                  Solicitado em {new Date(u.criadoEm).toLocaleDateString('pt-BR')}
                  {' · '}
                  <IdadeSolicitacao desde={u.criadoEm} />
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
                      ? 'Documentos do responsável e da empresa'
                      : 'Documentos do titular'}
                  </h3>
                  <DocumentosAdmin
                    idPublico={u.idPublico}
                    token={token}
                    onAtualizar={invalidate}
                  />
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
                        const codigoTotp = pedirCodigoTotp();
                        if (!codigoTotp) return;
                        try {
                          const fd = new FormData();
                          fd.append('tipoDocumento', 'CONTRATO_PRESTACAO_SERVICO');
                          fd.append('arquivo', f);
                          fd.append('codigoTotp', codigoTotp);
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
                            queryKey: ['admin-docs', u.idPublico],
                          });
                        } catch (e) {
                          onErro(e);
                        }
                      }}
                    />
                  </label>
                  {u.situacao === 'EM_ANALISE' && podeAprovar && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const codigoTotp = pedirCodigoTotp(
                            'Confirme a aprovação com o código 2FA da sua conta admin:',
                          );
                          if (!codigoTotp) return;
                          ativarUsuario.mutate({ id: u.idPublico, codigoTotp });
                        }}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Aprovar usuário
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const motivo = window.prompt('Motivo da reprovação:');
                          if (!motivo) return;
                          const codigoTotp = pedirCodigoTotp(
                            'Confirme a reprovação com o código 2FA da sua conta admin:',
                          );
                          if (!codigoTotp) return;
                          reprovarUsuario.mutate({
                            id: u.idPublico,
                            motivo,
                            codigoTotp,
                          });
                        }}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Reprovar usuário
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-800/20 p-6 text-center text-sm opacity-70 dark:border-white/20">
            {busca.trim()
              ? `Nenhum cadastro corresponde à busca "${busca.trim()}".`
              : `Nenhum cadastro em ${abaAtual.label.toLowerCase()}.`}
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
