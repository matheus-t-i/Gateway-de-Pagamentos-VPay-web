'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '@/components/shell';
import { BarraFiltros, FiltroTexto, Paginacao, SeletorPorPagina } from '@/components/tabela';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Persistencia = {
  id: string;
  quando: string;
  ator: string;
  origem: string;
  operacao: string;
  acao: string;
  tabela: string | null;
  chave: string | null;
  ip: string | null;
  metodo: string | null;
  caminho: string | null;
  sucesso: boolean;
  antes: unknown;
  depois: unknown;
  campos: unknown;
};
type Acesso = {
  id: string;
  quando: string;
  emailInformado: string | null;
  ip: string | null;
  sucesso: boolean;
  motivo: string | null;
  usuario: string | null;
};
type Resposta = {
  fonte: string;
  total: number;
  pagina: number;
  itens: Persistencia[] | Acesso[];
};

const dateCls =
  'mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-900';

const badgeSucesso = (ok: boolean) =>
  ok
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
    : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';

export default function AuditoriaPage() {
  const { token } = useAuth();
  const [fonte, setFonte] = useState<'persistencia' | 'acesso'>('persistencia');
  const [ator, setAtor] = useState('');
  const [acao, setAcao] = useState('');
  const [tabela, setTabela] = useState('');
  const [ip, setIp] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [aberto, setAberto] = useState<string | null>(null);

  const trocarFonte = (f: 'persistencia' | 'acesso') => {
    setFonte(f);
    setPagina(1);
    setAberto(null);
  };
  const reset = () => setPagina(1);
  const trocarLimite = (n: number) => {
    setLimite(n);
    setPagina(1);
  };

  const q = useQuery({
    queryKey: ['auditoria', fonte, ator, acao, tabela, ip, busca, dataInicial, dataFinal, pagina, limite],
    enabled: !!token,
    queryFn: () => {
      const p = new URLSearchParams({ fonte, page: String(pagina), limit: String(limite) });
      if (dataInicial) p.set('dataInicial', dataInicial);
      if (dataFinal) p.set('dataFinal', dataFinal);
      if (ip) p.set('ip', ip);
      if (fonte === 'persistencia') {
        if (ator) p.set('ator', ator);
        if (acao) p.set('acao', acao);
        if (tabela) p.set('tabela', tabela);
      } else if (busca) p.set('busca', busca);
      return api<Resposta>(`/admin/auditoria?${p.toString()}`, { token: token! });
    },
  });

  const total = q.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Auditoria</h1>
      <p className="mt-1 text-sm opacity-70">
        Monitoramento de todas as persistências (quem fez, IP, como era → como ficou) e
        dos acessos ao sistema.
      </p>

      <div className="mt-4 flex gap-2">
        {(['persistencia', 'acesso'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => trocarFonte(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              fonte === f
                ? 'bg-accent text-accent-foreground'
                : 'border border-ink-800/15 hover:bg-ink-800/5 dark:border-white/15 dark:hover:bg-white/5'
            }`}
          >
            {f === 'persistencia' ? 'Persistências' : 'Acessos'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <BarraFiltros>
          <label className="flex flex-col text-xs font-medium opacity-70">
            Data inicial
            <input type="date" className={dateCls} value={dataInicial} onChange={(e) => { setDataInicial(e.target.value); reset(); }} />
          </label>
          <label className="flex flex-col text-xs font-medium opacity-70">
            Data final
            <input type="date" className={dateCls} value={dataFinal} onChange={(e) => { setDataFinal(e.target.value); reset(); }} />
          </label>
          {fonte === 'persistencia' ? (
            <>
              <FiltroTexto label="Ator" value={ator} onChange={(v) => { setAtor(v); reset(); }} placeholder="nome ou e-mail" />
              <FiltroTexto label="Ação" value={acao} onChange={(v) => { setAcao(v); reset(); }} placeholder="ex.: ALTERNAR" />
              <FiltroTexto label="Tabela" value={tabela} onChange={(v) => { setTabela(v); reset(); }} placeholder="ex.: chaves_pix" />
            </>
          ) : (
            <FiltroTexto label="E-mail" value={busca} onChange={(v) => { setBusca(v); reset(); }} placeholder="e-mail informado" />
          )}
          <FiltroTexto label="IP" value={ip} onChange={(v) => { setIp(v); reset(); }} placeholder="IP" />
          <div className="ml-auto self-end">
            <SeletorPorPagina value={limite} onChange={trocarLimite} />
          </div>
        </BarraFiltros>

        <div className="rounded-lg border border-ink-800/10 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-xs uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
                {fonte === 'persistencia' ? (
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Quando</th>
                    <th className="px-4 py-2.5 font-medium">Ator</th>
                    <th className="px-4 py-2.5 font-medium">Ação</th>
                    <th className="px-4 py-2.5 font-medium">Tabela</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                    <th className="px-4 py-2.5 font-medium">Método</th>
                    <th className="px-4 py-2.5 font-medium">OK</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Quando</th>
                    <th className="px-4 py-2.5 font-medium">E-mail informado</th>
                    <th className="px-4 py-2.5 font-medium">Usuário</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                    <th className="px-4 py-2.5 font-medium">OK</th>
                    <th className="px-4 py-2.5 font-medium">Motivo</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {fonte === 'persistencia' &&
                  (q.data?.itens as Persistencia[] | undefined)?.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-b border-ink-800/5 dark:border-white/5">
                        <td className="px-4 py-3 text-xs">{new Date(r.quando).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3">{r.ator}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.acao}</td>
                        <td className="px-4 py-3 text-xs">{r.tabela ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.ip ?? '—'}</td>
                        <td className="px-4 py-3 text-xs">{r.metodo ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeSucesso(r.sucesso)}`}>
                            {r.sucesso ? 'sim' : 'não'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {Boolean(r.antes || r.depois) && (
                            <button
                              type="button"
                              className="text-xs text-accent underline"
                              onClick={() => setAberto(aberto === r.id ? null : r.id)}
                            >
                              {aberto === r.id ? 'Ocultar' : 'Antes/Depois'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {aberto === r.id && (
                        <tr className="bg-ink-800/[0.02] dark:bg-white/[0.02]">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="mb-1 text-xs font-semibold opacity-60">Como era</p>
                                <pre className="max-h-56 overflow-auto rounded-md border border-ink-800/10 bg-white p-2 text-xs dark:border-white/10 dark:bg-ink-950">
                                  {r.antes ? JSON.stringify(r.antes, null, 2) : '—'}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-semibold opacity-60">Como ficou</p>
                                <pre className="max-h-56 overflow-auto rounded-md border border-ink-800/10 bg-white p-2 text-xs dark:border-white/10 dark:bg-ink-950">
                                  {r.depois ? JSON.stringify(r.depois, null, 2) : '—'}
                                </pre>
                              </div>
                            </div>
                            {r.caminho && (
                              <p className="mt-2 font-mono text-xs opacity-60">{r.metodo} {r.caminho}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                {fonte === 'acesso' &&
                  (q.data?.itens as Acesso[] | undefined)?.map((a) => (
                    <tr key={a.id} className="border-b border-ink-800/5 dark:border-white/5">
                      <td className="px-4 py-3 text-xs">{new Date(a.quando).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3">{a.emailInformado ?? '—'}</td>
                      <td className="px-4 py-3 text-xs opacity-70">{a.usuario ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.ip ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeSucesso(a.sucesso)}`}>
                          {a.sucesso ? 'sim' : 'não'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{a.motivo ?? '—'}</td>
                    </tr>
                  ))}
                {!q.data?.itens.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-sm opacity-60">
                      {q.isLoading ? 'Carregando…' : 'Nenhum registro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
        </div>
      </div>
    </Shell>
  );
}
