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

type Usuario = {
  idPublico: string;
  email: string;
  nomeRazaoSocial: string;
  temaPreferido: 'PADRAO' | 'CLARO' | 'ESCURO';
  papeis: string[];
  tipoPessoa?: 'PF' | 'PJ';
  totpHabilitado?: boolean;
};

export type LoginResult = {
  situacao: string;
  proximoPasso?: string;
  mensagem?: string;
  motivo?: string | null;
  /** true quando a conta tem 2FA e o código ainda não foi informado. */
  requer2FA?: boolean;
  empresaIdPublico?: string | null;
  documentosFaltantes?: { usuario: string[]; empresa: string[] };
};

type AuthState = {
  token: string | null;
  usuario: Usuario | null;
  empresaId: string | null;
  /** true enquanto o token ainda está sendo lido do localStorage. */
  hidratando: boolean;
  login: (email: string, senha: string, codigoTotp?: string) => Promise<LoginResult>;
  logout: () => void;
  setEmpresaId: (id: string | null) => void;
  refreshMe: () => Promise<void>;
  patchTema: (tema: Usuario['temaPreferido']) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function mapTema(tema: Usuario['temaPreferido']): string {
  if (tema === 'CLARO') return 'light';
  if (tema === 'ESCURO') return 'dark';
  return 'system';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  /**
   * true até o token ser lido do localStorage. Sem isso, no primeiro render de
   * um carregamento completo o token é null e as telas redirecionam para o
   * login — um link direto para /configuracoes acabava caindo no /dashboard.
   */
  const [hidratando, setHidratando] = useState(true);
  const { setTheme } = useTheme();

  useEffect(() => {
    const t = localStorage.getItem('vpay_token');
    const e = localStorage.getItem('vpay_empresa');
    if (t) setToken(t);
    if (e) setEmpresaId(e);
    setHidratando(false);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const me = await api<Usuario & { empresas?: Array<{ idPublico: string }> }>(
      '/auth/me',
      { token },
    );
    setUsuario(me);
    setTheme(mapTema(me.temaPreferido));
    if (!empresaId && me.empresas?.[0]) {
      setEmpresaId(me.empresas[0].idPublico);
      localStorage.setItem('vpay_empresa', me.empresas[0].idPublico);
    }
  }, [token, empresaId, setTheme]);

  useEffect(() => {
    if (token) void refreshMe().catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = useCallback(
    async (
      email: string,
      senha: string,
      codigoTotp?: string,
    ): Promise<LoginResult> => {
      const res = await api<
        LoginResult & { accessToken?: string; usuario?: Usuario }
      >('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha, codigoTotp: codigoTotp || undefined }),
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

  const logout = useCallback(() => {
    localStorage.removeItem('vpay_token');
    localStorage.removeItem('vpay_empresa');
    setToken(null);
    setUsuario(null);
    setEmpresaId(null);
  }, []);

  const patchTema = useCallback(
    async (tema: Usuario['temaPreferido']) => {
      if (!token) return;
      const updated = await api<{ temaPreferido: Usuario['temaPreferido'] }>(
        '/auth/me',
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ temaPreferido: tema }),
        },
      );
      setUsuario((u) => (u ? { ...u, temaPreferido: updated.temaPreferido } : u));
      setTheme(mapTema(updated.temaPreferido));
    },
    [token, setTheme],
  );

  const value = useMemo(
    () => ({
      token,
      usuario,
      empresaId,
      hidratando,
      login,
      logout,
      setEmpresaId: (id: string | null) => {
        setEmpresaId(id);
        if (id) localStorage.setItem('vpay_empresa', id);
        else localStorage.removeItem('vpay_empresa');
      },
      refreshMe,
      patchTema,
    }),
    [token, usuario, empresaId, hidratando, login, logout, refreshMe, patchTema],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
