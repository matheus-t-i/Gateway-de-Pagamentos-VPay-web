/**
 * Fuso do produto: Brasília. Espelho mínimo de
 * `Gateway-de-Pagamentos-VPay-api/src/shared/fuso-brasilia.ts`.
 *
 * Persistência/JSON ISO continuam UTC. O que o humano vê no painel é BRT —
 * `toLocaleString('pt-BR')` sem `timeZone` usa o relógio da máquina e quebra
 * se alguém abrir de outro fuso.
 */
export const FUSO_BRASILIA = 'America/Sao_Paulo';

const TZ = { timeZone: FUSO_BRASILIA } as const;

type Instante = string | number | Date | null | undefined;

export function formatarDataHora(
  v: Instante,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  return new Date(v).toLocaleString('pt-BR', { ...TZ, ...opts });
}

export function formatarData(
  v: Instante,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  return new Date(v).toLocaleDateString('pt-BR', { ...TZ, ...opts });
}

export function formatarHora(
  v: Instante,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (v == null || v === '') return '—';
  return new Date(v).toLocaleTimeString('pt-BR', {
    ...TZ,
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

/** Dia/mês curto (eixo e período do dashboard). */
export function formatarDataCurta(v: string | Date): string {
  return formatarData(v, { day: '2-digit', month: '2-digit' });
}

/** Dia civil BRT `YYYY-MM-DD` — default do filtro "hoje". */
export function hojeISO(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export type PartesBrasilia = {
  year: number;
  month: number;
  day: number;
};

export function partesBrasilia(d = new Date()): PartesBrasilia {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO_BRASILIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

/** Dias inclusive até o fim do mês civil em Brasília. */
export function diasRestantesNoMesBrasilia(agora = new Date()): number {
  const p = partesBrasilia(agora);
  const ultimo = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  return Math.max(1, ultimo - p.day + 1);
}
