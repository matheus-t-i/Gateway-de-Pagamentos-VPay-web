export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

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
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(mensagemDeErro(await res.text(), res.status));
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
    throw new Error(mensagemDeErro(await res.text(), res.status));
  }
  return res.json() as Promise<T>;
}
