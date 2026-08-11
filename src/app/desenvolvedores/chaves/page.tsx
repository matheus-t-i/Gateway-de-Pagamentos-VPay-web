'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Shell } from '@/components/shell';
import { Modal, ModalAcoes } from '@/components/modal';
import { TextoRotulo } from '@/components/obrigatorio';
import {
  BarraFiltros,
  FiltroSelect,
  FiltroTexto,
  TabelaPaginada,
  type Coluna,
} from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATALOGO_ESCOPOS } from '@/lib/escopos';
import { PERMISSOES } from '@/lib/permissoes';
import { pedirCodigoTotp } from '@/lib/step-up-totp';
import { confirmarAcao } from '@/lib/dialogos';

type Credencial = {
  id: string;
  nome: string;
  chavePublica: string;
  escopos: string[];
  ativo: boolean;
  ipsPermitidos: string[];
  criadoEm: string;
  /** Rotação em andamento: até esta data o segredo ANTIGO também é aceito. */
  segredoAnteriorAtivoAte: string | null;
};

type NovaCredencial = {
  id: string;
  nome: string;
  chavePublica: string;
  segredo: string;
  aviso: string;
  /** Presente quando veio de uma rotação, não de uma criação. */
  segredoAnteriorAtivoAte?: string | null;
};

const inputCls =
  'mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/10 dark:bg-ink-900';

/**
 * Edição de uma chave já emitida: nome e allowlist de IP.
 *
 * A allowlist é editada como lista de itens (adicionar/remover um a um), não
 * como um campo de texto separado por vírgula: quem só quer liberar mais um IP
 * não precisa reescrever — nem arriscar apagar sem querer — os que já valem.
 */
function ModalEditar({
  credencial,
  token,
  onFechar,
  onSalvo,
}: {
  credencial: Credencial;
  token: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(credencial.nome);
  const [ips, setIps] = useState<string[]>(credencial.ipsPermitidos);
  const [novoIp, setNovoIp] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: (codigoTotp: string) =>
      api<Credencial>(`/painel/credenciais/${credencial.id}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ nome, ipsPermitidos: ips, codigoTotp }),
      }),
    onSuccess: () => {
      onSalvo();
      onFechar();
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao salvar'),
  });

  function adicionarIp() {
    const valor = novoIp.trim();
    if (!valor) return;
    if (ips.includes(valor)) {
      setErro('Este IP já está na lista.');
      return;
    }
    setIps((atual) => [...atual, valor]);
    setNovoIp('');
    setErro(null);
  }

  return (
    <Modal open onClose={onFechar} title={`Editar ${credencial.nome}`}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          const codigoTotp = await pedirCodigoTotp();
          if (!codigoTotp) return;
          salvar.mutate(codigoTotp);
        }}
        className="space-y-4"
      >
        <p className="rounded-lg bg-ink-800/[0.03] px-3 py-2 font-mono text-xs break-all opacity-70 dark:bg-white/[0.03]">
          {credencial.chavePublica}
        </p>

        <label className="block text-sm">
          <TextoRotulo obrigatorio>Nome</TextoRotulo>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>

        <div className="text-sm">
          <p className="font-medium">IPs permitidos</p>
          <p className="mt-0.5 text-xs opacity-60">
            Lista vazia libera qualquer origem. Aceita IP (203.0.113.10) ou faixa
            (198.51.100.0/24).
          </p>

          {/* Enter adiciona o IP; sem `type="button"` no botão, o Enter do campo
              submeteria o formulário inteiro em vez de incluir na lista. */}
          <div className="mt-2 flex gap-2">
            <input
              className={`${inputCls} mt-0 flex-1 font-mono`}
              value={novoIp}
              onChange={(e) => setNovoIp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  adicionarIp();
                }
              }}
              placeholder="203.0.113.10"
            />
            <button
              type="button"
              onClick={adicionarIp}
              disabled={!novoIp.trim()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-800/15 px-3 text-sm font-medium transition hover:bg-ink-800/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/5"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Adicionar
            </button>
          </div>

          {ips.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ips.map((ip) => (
                <li
                  key={ip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink-800/[0.06] py-1 pl-3 pr-1.5 font-mono text-xs dark:bg-white/[0.08]"
                >
                  {ip}
                  <button
                    type="button"
                    onClick={() => setIps((atual) => atual.filter((i) => i !== ip))}
                    aria-label={`Remover ${ip}`}
                    className="rounded-full p-0.5 opacity-60 transition hover:bg-red-500/20 hover:text-red-600 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs">
              Sem restrição de origem: esta chave funciona de qualquer IP.
            </p>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <ModalAcoes onCancelar={onFechar} pendente={salvar.isPending} />
      </form>
    </Modal>
  );
}

export default function ChavesApiPage() {
  const { token, pode } = useAuth();
  const podeCriar = pode(PERMISSOES.CHAVES_API_CRIAR);
  const podeEditar = pode(PERMISSOES.CHAVES_API_EDITAR);
  const podeRevogar = pode(PERMISSOES.CHAVES_API_EXCLUIR);
  const [editando, setEditando] = useState<Credencial | null>(null);
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [ips, setIps] = useState('');
  const [escopos, setEscopos] = useState<string[]>([]);
  const [criada, setCriada] = useState<NovaCredencial | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  const credenciais = useQuery({
    queryKey: ['credenciais'],
    enabled: !!token,
    queryFn: () =>
      api<Credencial[]>('/painel/credenciais', { token: token! }),
  });

  const criar = useMutation({
    mutationFn: (body: {
      nome: string;
      ipsPermitidos: string[];
      escopos: string[];
      codigoTotp: string;
    }) =>
      api<NovaCredencial>('/painel/credenciais', {
        token: token!,
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (nova) => {
      setCriada(nova);
      setNome('');
      setIps('');
      setEscopos([]);
      setErro(null);
      void qc.invalidateQueries({ queryKey: ['credenciais'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao criar'),
  });

  const rotacionar = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api<NovaCredencial>(`/painel/credenciais/${p.id}/rotacionar`, {
        token: token!,
        method: 'POST',
        body: JSON.stringify({ diasJanela: 7, codigoTotp: p.codigoTotp }),
      }),
    onSuccess: (nova) => {
      // Mesma caixa do segredo recém-criado: é a única vez que ele aparece.
      setCriada(nova);
      void qc.invalidateQueries({ queryKey: ['credenciais'] });
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao rotacionar'),
  });

  const encerrarJanela = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api(`/painel/credenciais/${p.id}/segredo-anterior`, {
        token: token!,
        method: 'DELETE',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['credenciais'] }),
    onError: (e) => setErro(e instanceof Error ? e.message : 'Falha ao encerrar a janela'),
  });

  const revogar = useMutation({
    mutationFn: (p: { id: string; codigoTotp: string }) =>
      api(`/painel/credenciais/${p.id}`, {
        token: token!,
        method: 'DELETE',
        body: JSON.stringify({ codigoTotp: p.codigoTotp }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['credenciais'] }),
  });

  async function onCriar(e: FormEvent) {
    e.preventDefault();
    // Sem escopo a chave não abre NENHUMA rota da API (403 em tudo). Barrar
    // aqui evita emitir um par de credenciais que nasce inútil e não pode ser
    // consertado depois — escopo não é editável.
    if (!escopos.length) {
      setErro('Marque ao menos uma permissão: sem escopo a chave não acessa nada.');
      return;
    }
    const codigoTotp = await pedirCodigoTotp();
    if (!codigoTotp) return;
    criar.mutate({
      nome,
      escopos,
      ipsPermitidos: ips
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      codigoTotp,
    });
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (credenciais.data ?? []).filter((c) => {
      const casaBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.chavePublica.toLowerCase().includes(termo);
      const casaSituacao =
        !situacao ||
        (situacao === 'ativa' ? c.ativo : !c.ativo);
      return casaBusca && casaSituacao;
    });
  }, [credenciais.data, busca, situacao]);

  const colunas: Coluna<Credencial>[] = [
    { chave: 'nome', titulo: 'Nome', render: (c) => <span className="font-medium">{c.nome}</span> },
    {
      chave: 'chavePublica',
      titulo: 'Chave pública',
      className: 'font-mono text-xs',
      render: (c) => c.chavePublica,
    },
    {
      // Chave sem escopo responde 403 em toda rota — precisa gritar na lista,
      // não ficar escondida atrás de um "por que minha integração não funciona".
      chave: 'escopos',
      titulo: 'Permissões',
      render: (c) =>
        c.escopos?.length ? (
          <span className="font-mono text-[11px] opacity-70">
            {c.escopos.join(' · ')}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-500/20 dark:text-red-300">
            sem permissão — não acessa nada
          </span>
        ),
    },
    {
      chave: 'ips',
      titulo: 'IPs permitidos',
      render: (c) =>
        c.ipsPermitidos.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {c.ipsPermitidos.map((ip) => (
              <span
                key={ip}
                className="rounded bg-ink-800/[0.06] px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/[0.08]"
              >
                {ip}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs opacity-55">Qualquer origem</span>
        ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (c) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            c.ativo
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
          }`}
        >
          {c.ativo ? 'Ativa' : 'Revogada'}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      className: 'text-right',
      render: (c) =>
        c.ativo ? (
          <span className="flex flex-wrap justify-end gap-3">
            {podeEditar && (
              <>
                <button
                  type="button"
                  onClick={() => setEditando(c)}
                  className="text-xs underline"
                >
                  Editar
                </button>
                {/*
                  Rotacionar gera um segredo novo mantendo o antigo válido por
                  uma janela — é o que permite trocar a chave em produção sem
                  derrubar as vendas enquanto a frota atualiza.
                */}
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      await confirmarAcao({
                        titulo: `Gerar novo segredo para "${c.nome}"?`,
                        mensagem:
                          'O segredo atual continua válido por 7 dias, para você atualizar suas aplicações sem parar de vender. A chave pública não muda.',
                        rotuloConfirmar: 'Gerar novo segredo',
                      })
                    ) {
                      setErro(null);
                      const codigoTotp = await pedirCodigoTotp();
                      if (!codigoTotp) return;
                      rotacionar.mutate({ id: c.id, codigoTotp });
                    }
                  }}
                  disabled={rotacionar.isPending}
                  className="text-xs underline disabled:opacity-40"
                >
                  Rotacionar segredo
                </button>
                {c.segredoAnteriorAtivoAte && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        await confirmarAcao({
                          titulo: 'Encerrar a janela agora?',
                          mensagem:
                            'O segredo anterior para de funcionar imediatamente — só faça isso depois de atualizar todas as suas aplicações.',
                          perigo: true,
                          rotuloConfirmar: 'Encerrar janela',
                        })
                      ) {
                        const codigoTotp = await pedirCodigoTotp();
                        if (!codigoTotp) return;
                        encerrarJanela.mutate({ id: c.id, codigoTotp });
                      }
                    }}
                    disabled={encerrarJanela.isPending}
                    className="text-xs text-amber-700 underline disabled:opacity-40 dark:text-amber-300"
                  >
                    Encerrar janela
                  </button>
                )}
              </>
            )}
            {podeRevogar && (
              <button
                type="button"
                onClick={async () => {
                  const codigoTotp = await pedirCodigoTotp();
                  if (!codigoTotp) return;
                  revogar.mutate({ id: c.id, codigoTotp });
                }}
                className="text-xs text-red-600 underline"
              >
                Revogar
              </button>
            )}
          </span>
        ) : null,
    },
  ];

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Chaves de API</h1>
      <p className="mt-1 text-sm opacity-70">
        Credenciais para integrar seus sistemas à API do gateway.
      </p>


          {/* Segredo recém-criado — exibido uma única vez */}
          {criada && (
            <div className="mt-6 rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Guarde o segredo agora — ele não será exibido novamente.
              </p>
              <div className="mt-3 space-y-1 break-all font-mono text-xs">
                <p>
                  <span className="opacity-60">x-api-key:</span> {criada.chavePublica}
                </p>
                <p>
                  <span className="opacity-60">x-api-secret:</span> {criada.segredo}
                </p>
              </div>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                O par gera o token de acesso em <code>POST /v1/auth/token</code>; as
                demais rotas usam o token (<code>Authorization: Bearer</code>) — veja a{' '}
                <a className="underline" href="/desenvolvedores/documentacao#autenticacao">
                  documentação
                </a>
                .
              </p>
              {/* Só aparece quando veio de uma rotação: explica a janela. */}
              {criada.segredoAnteriorAtivoAte && (
                <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                  O segredo anterior <strong>continua funcionando</strong> até{' '}
                  {new Date(criada.segredoAnteriorAtivoAte).toLocaleString('pt-BR')}.
                  Atualize suas aplicações e depois use{' '}
                  <strong>Encerrar janela</strong> para desativá-lo na hora.
                </p>
              )}
              <button
                type="button"
                className="mt-3 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => setCriada(null)}
              >
                Já copiei, ocultar
              </button>
            </div>
          )}

          <form
            onSubmit={onCriar}
            hidden={!podeCriar}
            className="mt-6 rounded-lg border border-ink-800/10 p-4 dark:border-white/10"
          >
            <h2 className="text-sm font-semibold">Nova chave</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <TextoRotulo obrigatorio>Nome</TextoRotulo>
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: produção loja X"
                  required
                />
              </label>
              <label className="block text-sm">
                IPs permitidos (separados por vírgula, vazio = todos)
                <input
                  className="mt-1 w-full rounded-md border border-ink-800/15 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900"
                  value={ips}
                  onChange={(e) => setIps(e.target.value)}
                  placeholder="203.0.113.10, 198.51.100.0/24"
                />
              </label>
            </div>

            {/*
              Escopo é o que a chave PODE fazer, e não é editável depois: uma
              chave emitida sem escopo responde 403 em toda rota e só resta
              revogar e criar outra.
            */}
            <p className="mt-4 text-xs font-medium opacity-60">
              <TextoRotulo obrigatorio>Permissões desta chave</TextoRotulo>
            </p>
            <div className="mt-2 space-y-2">
              {CATALOGO_ESCOPOS.map((esc) => (
                <label key={esc.codigo} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={escopos.includes(esc.codigo)}
                    onChange={(e) =>
                      setEscopos(
                        e.target.checked
                          ? [...escopos, esc.codigo]
                          : escopos.filter((c) => c !== esc.codigo),
                      )
                    }
                  />
                  <span>
                    {esc.rotulo}{' '}
                    <code className="font-mono text-xs opacity-60">{esc.codigo}</code>
                    <span className="block text-xs opacity-60">{esc.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-60">
              Marque só o que a integração precisa. As permissões não podem ser
              alteradas depois — para mudar, emita outra chave e revogue esta.
            </p>

            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={criar.isPending}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {criar.isPending ? 'Criando…' : 'Criar chave'}
            </button>
          </form>

          <div className="mt-6">
            <BarraFiltros>
              <FiltroTexto
                label="Buscar"
                value={busca}
                onChange={setBusca}
                placeholder="Nome ou chave pública"
              />
              <FiltroSelect label="Situação" value={situacao} onChange={setSituacao}>
                <option value="">Todas</option>
                <option value="ativa">Ativa</option>
                <option value="revogada">Revogada</option>
              </FiltroSelect>
            </BarraFiltros>

            <TabelaPaginada<Credencial>
              colunas={colunas}
              dados={filtradas}
              chave={(c) => c.id}
              carregando={credenciais.isLoading}
              tamanhoPagina={10}
              vazio="Nenhuma chave criada ainda."
            />
          </div>

      {editando && token && (
        <ModalEditar
          credencial={editando}
          token={token}
          onFechar={() => setEditando(null)}
          onSalvo={() => void qc.invalidateQueries({ queryKey: ['credenciais'] })}
        />
      )}
    </Shell>
  );
}
