'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type Coluna<T> = {
  chave: string;
  titulo: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
};

/** Barra de filtros no topo de uma listagem (layout mobile-first). */
export function BarraFiltros({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-ink-800/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
      {children}
    </div>
  );
}

/**
 * Classes do campo de filtro (rótulo + controle). Exportadas para filtros
 * ad-hoc (data, etc.) ficarem alinhados aos `Filtro*` dentro da `BarraFiltros`:
 * ocupam a largura toda no mobile e viram colunas de largura igual no desktop.
 */
export const campoFiltro =
  'flex min-w-[10rem] flex-1 basis-48 flex-col gap-1.5 text-xs font-medium text-ink-800/60 dark:text-white/60 sm:max-w-xs';
export const controleFiltro =
  'h-10 w-full rounded-md border border-ink-800/15 bg-white px-3 text-sm font-normal text-ink-950 outline-none transition [color-scheme:light] placeholder:text-ink-800/40 focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/15 dark:bg-ink-950 dark:text-white dark:[color-scheme:dark] dark:placeholder:text-white/35';

const rotuloInput = campoFiltro;
const controle = controleFiltro;

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
      {/* Seta própria: a nativa fica colada na borda e não acompanha o tema. */}
      <span className="relative block">
        <select
          className={`${controle} cursor-pointer appearance-none pr-9`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-800/60 dark:text-white/60"
          strokeWidth={1.75}
        />
      </span>
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

/** Campo de data padronizado para a barra de filtros. */
export function FiltroData({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={rotuloInput}>
      {label}
      <input
        type="date"
        className={controle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Botão "Limpar" da barra de filtros — alinhado à altura dos campos. */
export function BotaoLimparFiltros({
  onClick,
  children = 'Limpar',
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 w-full shrink-0 rounded-md border border-ink-800/15 px-4 text-sm text-accent transition hover:bg-accent/10 sm:w-auto dark:border-white/15"
    >
      {children}
    </button>
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
    <label className="flex items-center gap-1.5 text-xs text-ink-800/60 dark:text-white/60">
      Por página
      <span className="relative block">
        <select
          className="h-8 cursor-pointer appearance-none rounded-md border border-ink-800/15 bg-white pl-2.5 pr-7 text-xs text-ink-950 outline-none transition [color-scheme:light] focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-white/15 dark:bg-ink-950 dark:text-white dark:[color-scheme:dark]"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {OPCOES_POR_PAGINA.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-800/60 dark:text-white/60"
          strokeWidth={1.75}
        />
      </span>
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
