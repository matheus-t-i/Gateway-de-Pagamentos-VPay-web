'use client';

import { useEffect, useState } from 'react';

export type Coluna<T> = {
  chave: string;
  titulo: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
};

/** Barra de filtros no topo de uma listagem (layout mobile-first). */
export function BarraFiltros({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-ink-800/10 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
      {children}
    </div>
  );
}

const rotuloInput =
  'flex flex-col text-xs font-medium opacity-70';
const controle =
  'mt-1 rounded-md border border-ink-800/15 bg-white px-2 py-1.5 text-sm font-normal opacity-100 dark:border-white/15 dark:bg-ink-900';

/** Campo select padronizado para a barra de filtros. */
export function FiltroSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={rotuloInput}>
      {label}
      <select className={controle} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

/** Campo de texto padronizado para a barra de filtros. */
export function FiltroTexto({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={rotuloInput}>
      {label}
      <input
        className={controle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

/** Opções de tamanho de página para as telas de administrador. */
export const OPCOES_POR_PAGINA = [10, 25, 50, 100, 500, 1000];

/** Seletor "Por página" — só nas telas de admin (usuário comum é fixo em 10). */
export function SeletorPorPagina({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs opacity-70">
      Por página
      <select
        className="rounded border border-ink-800/15 bg-white px-1.5 py-1 text-xs dark:border-white/15 dark:bg-ink-900"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {OPCOES_POR_PAGINA.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  onPagina,
  seletor,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  onPagina: (p: number) => void;
  seletor?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-800/10 px-4 py-3 text-sm dark:border-white/10">
      <span className="flex items-center gap-3 text-xs opacity-60">
        <span>
          {total} registro{total === 1 ? '' : 's'}
          {totalPaginas > 1 && ` · página ${pagina} de ${totalPaginas}`}
        </span>
        {seletor}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => onPagina(pagina - 1)}
            className="rounded-md border border-ink-800/15 px-3 py-1 text-xs disabled:opacity-40 dark:border-white/15"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => onPagina(pagina + 1)}
            className="rounded-md border border-ink-800/15 px-3 py-1 text-xs disabled:opacity-40 dark:border-white/15"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Tabela com paginação. Dois modos:
 *  - CLIENTE (padrão): recebe `dados` completos e pagina no navegador.
 *  - SERVIDOR: passe `total`, `pagina` e `onPagina` (dados = página atual).
 */
export function TabelaPaginada<T>({
  colunas,
  dados,
  chave,
  vazio = 'Nenhum registro.',
  carregando = false,
  tamanhoPagina = 10,
  seletorTamanho = false,
  total,
  pagina,
  onPagina,
}: {
  colunas: Coluna<T>[];
  dados: T[];
  chave: (row: T) => string;
  vazio?: React.ReactNode;
  carregando?: boolean;
  tamanhoPagina?: number;
  /** Só telas de admin: mostra o seletor "Por página" (modo cliente). */
  seletorTamanho?: boolean;
  total?: number;
  pagina?: number;
  onPagina?: (p: number) => void;
}) {
  const servidor = total != null && pagina != null && onPagina != null;
  const [paginaLocal, setPaginaLocal] = useState(1);
  const [tamanhoLocal, setTamanhoLocal] = useState(tamanhoPagina);
  const tamanho = servidor ? tamanhoPagina : tamanhoLocal;

  // Modo cliente: volta à página 1 quando o conjunto/tamanho muda.
  useEffect(() => {
    if (!servidor) setPaginaLocal(1);
  }, [servidor, dados.length, tamanhoLocal]);

  const pAtual = servidor ? (pagina as number) : paginaLocal;
  const totalItens = servidor ? (total as number) : dados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / tamanho));
  const inicio = (pAtual - 1) * tamanho;
  const visiveis = servidor ? dados : dados.slice(inicio, inicio + tamanho);
  const irPara = servidor ? (onPagina as (p: number) => void) : setPaginaLocal;

  return (
    <div className="rounded-lg border border-ink-800/10 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-xs uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
            <tr>
              {colunas.map((c) => (
                <th key={c.chave} className={`px-4 py-2.5 font-medium ${c.className ?? ''}`}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((row) => (
              <tr
                key={chave(row)}
                className="border-b border-ink-800/5 last:border-0 dark:border-white/5"
              >
                {colunas.map((c) => (
                  <td key={c.chave} className={`px-4 py-3 ${c.className ?? ''}`}>
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.chave] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {!visiveis.length && (
              <tr>
                <td className="px-4 py-8 text-sm opacity-60" colSpan={colunas.length}>
                  {carregando ? 'Carregando…' : vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacao
        pagina={pAtual}
        totalPaginas={totalPaginas}
        total={totalItens}
        onPagina={irPara}
        seletor={
          seletorTamanho && !servidor ? (
            <SeletorPorPagina value={tamanhoLocal} onChange={setTamanhoLocal} />
          ) : undefined
        }
      />
    </div>
  );
}
