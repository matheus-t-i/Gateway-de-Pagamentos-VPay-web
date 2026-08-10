import { avisarTotpObrigatorioSeAplicavel } from './step-up-totp-bridge';

const urlConfigurada = process.env.NEXT_PUBLIC_API_URL;
/**
 * Fail-fast: build de produção SEM a variável derruba o `next build` na hora,
 * em vez de publicar um painel que chama localhost em silêncio — a falha só
 * aparecia no browser do cliente. Em dev o fallback continua valendo.
 */
if (!urlConfigurada && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_API_URL não configurada — o painel publicado chamaria ' +
      'http://localhost:3001. Defina a variável no ambiente de build.',
  );
}
export const API_URL = urlConfigurada ?? 'http://localhost:3001/api';

/**
 * 401 numa rota AUTENTICADA = sessão morta: credencial revogada, perfil
 * inativado, conta bloqueada ou token vencido. O timer sobre o `exp` do JWT
 * (auth.tsx) cobre só a expiração — os outros casos chegavam como "erro ao
 * carregar" e o usuário ficava preso numa tela quebrada. Aqui a sessão é
 * encerrada e o login explica (`?sessao=encerrada`).
 *
 * Só dispara quando a chamada levou token: login, onboarding e reset de senha
 * recebem 401 legítimos de credencial errada e precisam mostrar o erro na
 * própria tela.
 */
function encerrarSessaoPor401() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('vpay_token');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login?sessao=encerrada';
  }
}

/**
 * Extrai a mensagem legível do corpo de erro da API.
 *
 * Sem isto o `Error` carregava o JSON cru e a tela mostrava
 * `{"message":"Conta já ativa. Use o login.","error":"Bad Request",...}`
 * para o usuário final. Cobre os três formatos que a API produz: string
 * simples (Nest), array de strings (class-validator) e o flatten do Zod
 * (`{ formErrors, fieldErrors }`).
 */
function mensagemDeErro(texto: string, status: number): string {
  if (!texto) return `Erro ${status}`;
  try {
    const corpo = JSON.parse(texto) as {
      message?: unknown;
      error?: string;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };

    const msg = corpo.message;
    if (typeof msg === 'string' && msg) return msg;
    if (Array.isArray(msg) && msg.length) return msg.map(String).join(' · ');

    // Zod flatten pode vir na raiz ou dentro de `message`.
    const flat =
      corpo.formErrors || corpo.fieldErrors
        ? corpo
        : (msg as { formErrors?: string[]; fieldErrors?: Record<string, string[]> });
    if (flat && typeof flat === 'object') {
      const campos = Object.values(flat.fieldErrors ?? {}).flat();
      const juntos = [...(flat.formErrors ?? []), ...campos].filter(Boolean);
      if (juntos.length) return juntos.join(' · ');
    }

    if (typeof corpo.error === 'string' && corpo.error) return corpo.error;
  } catch {
    // Corpo não-JSON (HTML de proxy, texto solto): devolve como veio.
    return texto;
  }
  return `Erro ${status}`;
}

/**
 * Upload multipart (FormData). Não passa pelo api() porque este fixa o
 * content-type JSON — aqui o browser define o boundary sozinho.
 */
function erroDaResposta(texto: string, status: number): Error {
  const mensagem = mensagemDeErro(texto, status);
  if (status === 403) avisarTotpObrigatorioSeAplicavel(mensagem);
  return new Error(mensagem);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: form });
  if (!res.ok) {
    throw erroDaResposta(await res.text(), res.status);
  }
  return res.json() as Promise<T>;
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401 && token) encerrarSessaoPor401();
    throw erroDaResposta(await res.text(), res.status);
  }
  return res.json() as Promise<T>;
}

