'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { badgeDocumento as badge, DocumentosAdmin } from '@/components/documentos-admin';
import { IdadeSolicitacao } from '@/components/status';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarDocumento } from '@/lib/documento';
import { formatarData } from '@/lib/fuso';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { pedirTexto } from '@/lib/dialogos';

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
    mutationFn: (p: {
      id: string;
      codigoTotp: string;
      /** Exceção de KYC: exige justificativa e vira registro de auditoria. */
      semDocumentacao?: boolean;
      justificativa?: string;
    }) =>
      api(`/admin/usuarios/${p.id}/ativar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({
          codigoTotp: p.codigoTotp,
          ...(p.semDocumentacao
            ? { semDocumentacao: true, justificativa: p.justificativa }
            : {}),
        }),
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
                  Solicitado em {formatarData(u.criadoEm)}
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
                  {/* O envio pela VPay (contrato assinado e, quando o cliente
                      não manda, a própria documentação) mora no componente:
                      assim a ficha do cliente em /admin/usuarios tem o mesmo
                      recurso, sem duplicar o formulário. */}
                  <DocumentosAdmin
                    idPublico={u.idPublico}
                    token={token}
                    tipoPessoa={u.tipoPessoa}
                    onAtualizar={invalidate}
                  />
                  {/* Ativar SEM documentação: vale também para quem está
                      PENDENTE (o cliente nunca enviou nada), que é justamente
                      o caso em que o botão normal não aparece. Fica separado e
                      em âmbar de propósito — é exceção de KYC, não pode ser
                      clicado por engano no lugar da aprovação normal. */}
                  {(u.situacao === 'EM_ANALISE' || u.situacao === 'PENDENTE') &&
                    podeAprovar && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const justificativa = await pedirTexto({
                              titulo: 'Ativar sem a documentação completa',
                              mensagem:
                                'Isto libera a conta para movimentar dinheiro sem o KYC concluído e fica registrado na auditoria.',
                              rotulo: 'Justificativa',
                              minimo: 10,
                              maximo: 500,
                              perigo: true,
                              rotuloConfirmar: 'Ativar sem documentação',
                            });
                            if (!justificativa) return;
                            const codigoTotp = await pedirCodigoTotp(
                              'Confirme a ativação SEM documentação com o código 2FA:',
                            );
                            if (!codigoTotp) return;
                            ativarUsuario.mutate({
                              id: u.idPublico,
                              codigoTotp,
                              semDocumentacao: true,
                              justificativa: justificativa.trim(),
                            });
                          }}
                          className="rounded-md border border-amber-500 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          Ativar sem documentação
                        </button>
                      </div>
                    )}
                  {u.situacao === 'EM_ANALISE' && podeAprovar && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const codigoTotp = await pedirCodigoTotp(
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
                        onClick={async () => {
                          const motivo = await pedirTexto({
                            titulo: 'Reprovar cadastro',
                            mensagem:
                              'O motivo fica registrado no histórico da conta e é o que o cliente consulta depois.',
                            rotulo: 'Motivo da reprovação',
                            minimo: 3,
                            maximo: 500,
                            perigo: true,
                            rotuloConfirmar: 'Reprovar',
                          });
                          if (!motivo) return;
                          const codigoTotp = await pedirCodigoTotp(
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
