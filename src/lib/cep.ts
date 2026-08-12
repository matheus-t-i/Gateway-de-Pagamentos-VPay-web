/**
 * Consulta pública de CEP.
 *
 * A API oficial dos Correios (`api.correios.com.br/cep`) exige contrato
 * comercial + token. A base pública que todo cadastro brasileiro usa é a
 * ViaCEP (dados dos Correios). Se ela cair, tenta a BrasilAPI. Qualquer
 * falha devolve `indisponivel` — o formulário continua editável à mão.
 */

export type EnderecoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ResultadoCep =
  | { ok: true; endereco: EnderecoCep }
  | { ok: false; motivo: 'nao_encontrado' | 'indisponivel' };

export type SituacaoCep =
  | 'idle'
  | 'buscando'
  | 'ok'
  | 'nao_encontrado'
  | 'indisponivel';

const TIMEOUT_MS = 4_000;

function soDigitos(cep: string): string {
  return (cep ?? '').replace(/\D/g, '');
}

function comTimeout(pai?: AbortSignal): {
  signal: AbortSignal;
  limpar: () => void;
} {
  const ac = new AbortController();
  if (pai?.aborted) {
    ac.abort();
    return { signal: ac.signal, limpar: () => undefined };
  }
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const noPai = () => ac.abort();
  pai?.addEventListener('abort', noPai, { once: true });
  return {
    signal: ac.signal,
    limpar: () => {
      clearTimeout(t);
      pai?.removeEventListener('abort', noPai);
    },
  };
}

async function getJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  const j: unknown = await r.json();
  return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

async function viaCep(
  cep: string,
  signal: AbortSignal,
): Promise<ResultadoCep | 'falhou'> {
  try {
    const j = await getJson(`https://viacep.com.br/ws/${cep}/json/`, signal);
    if (!j) return 'falhou';
    if (j.erro === true) return { ok: false, motivo: 'nao_encontrado' };
    const cidade = str(j.localidade);
    const uf = str(j.uf).toUpperCase();
    if (!cidade || uf.length !== 2) return { ok: false, motivo: 'nao_encontrado' };
    return {
      ok: true,
      endereco: {
        logradouro: str(j.logradouro),
        bairro: str(j.bairro),
        cidade,
        uf,
      },
    };
  } catch {
    return 'falhou';
  }
}

async function brasilApi(
  cep: string,
  signal: AbortSignal,
): Promise<ResultadoCep | 'falhou'> {
  try {
    const j = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, signal);
    if (!j) return 'falhou';
    const cidade = str(j.city);
    const uf = str(j.state).toUpperCase();
    if (!cidade || uf.length !== 2) return { ok: false, motivo: 'nao_encontrado' };
    return {
      ok: true,
      endereco: {
        logradouro: str(j.street),
        bairro: str(j.neighborhood),
        cidade,
        uf,
      },
    };
  } catch {
    return 'falhou';
  }
}

export async function consultarCep(
  cep: string,
  signal?: AbortSignal,
): Promise<ResultadoCep> {
  const d = soDigitos(cep);
  if (!/^\d{8}$/.test(d)) return { ok: false, motivo: 'nao_encontrado' };

  const t1 = comTimeout(signal);
  const a = await viaCep(d, t1.signal);
  t1.limpar();
  if (a !== 'falhou') return a;

  const t2 = comTimeout(signal);
  const b = await brasilApi(d, t2.signal);
  t2.limpar();
  if (b !== 'falhou') return b;

  return { ok: false, motivo: 'indisponivel' };
}

export function textoSituacaoCep(s: SituacaoCep): string | null {
  if (s === 'buscando') return 'Consultando CEP…';
  if (s === 'nao_encontrado') return 'CEP não encontrado. Preencha o endereço.';
  if (s === 'indisponivel') return 'Consulta indisponível. Preencha o endereço.';
  return null;
}
