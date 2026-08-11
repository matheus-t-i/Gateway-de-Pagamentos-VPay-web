'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import { api } from './api';
import { limparCredsOnboarding } from './onboarding';
import type { CodigoPermissao } from './permissoes';
import { pedirCodigoTotp } from './step-up-totp';

type Usuario = {
  idPublico: string;
  email: string;
  cpfCnpj?: string;
  nomeRazaoSocial: string;
  nomeFantasia?: string | null;
  telefone?: string | null;
  situacao?: string;
  temaPreferido: 'PADRAO' | 'CLARO' | 'ESCURO';
  papeis: string[];
  /** Permissões efetivas dos perfis de acesso do usuário. */
  permissoes?: string[];
  tipoPessoa?: 'PF' | 'PJ';
  totpHabilitado?: boolean;
  /** Última troca de senha — exibida em Configurações. */
  senhaAlteradaEm?: string | null;
  /** Carteira da conta — o usuário É a conta, então o saldo vem junto. */
  saldo?: {
    disponivel: string;
    pendenteLiberacao: string;
    reservado: string;
    bloqueadoMed: string;
    bloqueadoManual: string;
  } | null;
};

export type LoginResult = {
  situacao: string;
  proximoPasso?: string;
  mensagem?: string;
  motivo?: string | null;
  /** true quando a conta tem 2FA e o código ainda não foi informado. */
  requer2FA?: boolean;
  /** Admin sem TOTP: token emitido, mas painel deve forçar ativação. */
  requerAtivar2FA?: boolean;
  /** true quando o admin redefiniu a senha e a troca ainda não foi feita. */
  requerTrocaSenha?: boolean;
  documentosFaltantes?: string[];
};

type AuthState = {
  token: string | null;
  usuario: Usuario | null;
  /** Instante (epoch ms) em que o token expira, lido do `exp` do próprio JWT. */
  expiraEm: number | null;
  /** true enquanto o token ainda está sendo lido do localStorage. */
  hidratando: boolean;
  /**
   * Permissão concedida pelo perfil de acesso. Serve para esconder menu e
   * botões — a barreira real é o 403 da API, que não depende disto.
   */
  pode: (codigo: CodigoPermissao) => boolean;
  login: (
    email: string,
    senha: string,
    codigoTotp?: string,
    turnstileToken?: string,
  ) => Promise<LoginResult>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  patchTema: (tema: Usuario['temaPreferido']) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function mapTema(tema: Usuario['temaPreferido']): string {
  if (tema === 'CLARO') return 'light';
  if (tema === 'ESCURO') return 'dark';
  return 'system';
}

/**
 * Lê o `exp` do JWT (epoch ms). Sem verificar assinatura de propósito: isto é
 * só para mostrar o contador na tela e encerrar a sessão na hora certa — quem
 * valida o token de verdade é a API.
 */
function expiracaoDoToken(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  /**
   * true até o token ser lido do localStorage. Sem isso, no primeiro render de
   * um carregamento completo o token é null e as telas redirecionam para o
   * login — um link direto para /configuracoes acabava caindo no /dashboard.
   */
  const [hidratando, setHidratando] = useState(true);
  const { setTheme } = useTheme();

  useEffect(() => {
    const t = localStorage.getItem('vpay_token');
    if (t) setToken(t);
    setHidratando(false);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const me = await api<Usuario>('/auth/me', { token });
    setUsuario(me);
    setTheme(mapTema(me.temaPreferido));
  }, [token, setTheme]);

  useEffect(() => {
    if (token) void refreshMe().catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = useCallback(
    async (
      email: string,
      senha: string,
      codigoTotp?: string,
      turnstileToken?: string,
    ): Promise<LoginResult> => {
      const res = await api<
        LoginResult & { accessToken?: string; usuario?: Usuario }
      >('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          senha,
          codigoTotp: codigoTotp || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      // Regra de segurança: só conta APROVADA (ATIVO) recebe/persiste token.
      if (res.situacao === 'ATIVO' && res.accessToken && res.usuario) {
        localStorage.setItem('vpay_token', res.accessToken);
        setToken(res.accessToken);
        setUsuario(res.usuario);
        setTheme(mapTema(res.usuario.temaPreferido));
      }
      return res;
    },
    [setTheme],
  );

  /**
   * Encerra a sessão e leva ao login.
   *
   * O redirecionamento é explícito de propósito: antes o logout só limpava o
   * estado e quem levava ao /login era um efeito do `Shell`. Fora dele — ou com
   * credenciais de onboarding ainda guardadas na aba — o usuário ficava numa
   * tela sem saída. Sair também descarta o onboarding: são credenciais de outra
   * conta que não têm nada a ver com quem acabou de sair.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('vpay_token');
    limparCredsOnboarding();
    setToken(null);
    setUsuario(null);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  const expiraEm = useMemo(() => (token ? expiracaoDoToken(token) : null), [token]);

  /**
   * Encerra a sessão sozinho quando o token expira. Sem isto o painel continua
   * na tela com um token morto e o usuário só descobre no primeiro 401 — que,
   * dependendo da tela, aparece como "erro ao carregar" em vez de "sessão
   * expirada". Também cobre o token já vencido guardado no localStorage.
   */
  useEffect(() => {
    if (!expiraEm) return;
    const restante = expiraEm - Date.now();
    if (restante <= 0) {
      logout();
      return;
    }
    const id = setTimeout(logout, restante);
    return () => clearTimeout(id);
  }, [expiraEm, logout]);

  const patchTema = useCallback(
    async (tema: Usuario['temaPreferido']) => {
      if (!token) return;
      const codigoTotp = await pedirCodigoTotp();
      if (!codigoTotp) return;
      const updated = await api<{ temaPreferido: Usuario['temaPreferido'] }>(
        '/auth/me',
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ temaPreferido: tema, codigoTotp }),
        },
      );
      setUsuario((u) => (u ? { ...u, temaPreferido: updated.temaPreferido } : u));
      setTheme(mapTema(updated.temaPreferido));
    },
    [token, setTheme],
  );

  const pode = useCallback(
    (codigo: CodigoPermissao) => usuario?.permissoes?.includes(codigo) ?? false,
    [usuario],
  );

  const value = useMemo(
    () => ({
      token,
      usuario,
      expiraEm,
      hidratando,
      pode,
      login,
      logout,
      refreshMe,
      patchTema,
    }),
    [
      token,
      usuario,
      expiraEm,
      hidratando,
      pode,
      login,
      logout,
      refreshMe,
      patchTema,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
