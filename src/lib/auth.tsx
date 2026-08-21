'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import { api } from './api';
import { limparCredsOnboarding } from './onboarding';
import type { CodigoPermissao } from './permissoes';
import {
  estaNaJanelaDeRenovacao,
  instanteRenovacao,
  MARGEM_MINIMA_RENOVACAO_MS,
  type JanelaToken,
} from './sessao-painel';

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
 * Lê `iat` e `exp` do JWT (epoch ms). Sem verificar assinatura de propósito:
 * isto é só para mostrar o contador na tela, pedir a renovação na hora certa e
 * encerrar a sessão quando vencer — quem valida o token de verdade é a API.
 */
function janelaDoToken(token: string): JanelaToken | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { iat, exp } = JSON.parse(json) as { iat?: number; exp?: number };
    if (typeof exp !== 'number') return null;
    // Sem `iat` a validade total é desconhecida: a janela nasce com duração
    // zero, o que desliga a renovação e deixa a sessão expirar normalmente —
    // desfecho seguro para um token que não sabemos ler por inteiro.
    return {
      emitidoEm: (typeof iat === 'number' ? iat : exp) * 1000,
      expiraEm: exp * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Intervalo entre tentativas quando a renovação falha. Curto e constante de
 * propósito: a falha típica é um soluço de rede, e a janela inteira (os 25%
 * finais da validade) é o orçamento de tentativas.
 */
const INTERVALO_RETENTATIVA_RENOVACAO_MS = 60_000;

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
  /** Trava de reentrância: o timer e o `visibilitychange` podem cair juntos. */
  const renovando = useRef(false);

  /**
   * Único lugar que grava o token: localStorage (o que sobrevive ao reload) e
   * estado (o que as telas leem). Login e renovação passam pelos dois.
   */
  const guardarToken = useCallback((novo: string) => {
    localStorage.setItem('vpay_token', novo);
    setToken(novo);
  }, []);

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
        guardarToken(res.accessToken);
        setUsuario(res.usuario);
        setTheme(mapTema(res.usuario.temaPreferido));
      }
      return res;
    },
    [setTheme, guardarToken],
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

  const janela = useMemo(() => (token ? janelaDoToken(token) : null), [token]);
  const expiraEm = janela?.expiraEm ?? null;

  /**
   * Encerra a sessão sozinho quando o token expira. Sem isto o painel continua
   * na tela com um token morto e o usuário só descobre no primeiro 401 — que,
   * dependendo da tela, aparece como "erro ao carregar" em vez de "sessão
   * expirada". Também cobre o token já vencido guardado no localStorage.
   */
  useEffect(() => {
    if (!expiraEm) return;

    /**
     * Antes de derrubar, confere o localStorage: OUTRA aba pode ter renovado a
     * sessão. Aba em segundo plano não renova (de propósito), então sem esta
     * adoção ela venceria primeiro e apagaria o token de quem está trabalhando
     * na aba da frente — o oposto do que a renovação existe para fazer.
     */
    const encerrar = () => {
      const guardado = localStorage.getItem('vpay_token');
      if (guardado && guardado !== token) {
        const outra = janelaDoToken(guardado);
        if (outra && outra.expiraEm > Date.now()) {
          setToken(guardado);
          return;
        }
      }
      logout();
    };

    const restante = expiraEm - Date.now();
    if (restante <= 0) {
      encerrar();
      return;
    }
    const id = setTimeout(encerrar, restante);
    return () => clearTimeout(id);
  }, [expiraEm, logout, token]);

  /**
   * Renovação silenciosa: troca o token por um novo quando resta 25% da
   * validade (`instanteRenovacao`), para quem está no meio de uma tarefa não
   * perder a tela por causa do relógio. É a MESMA sessão continuando — o token
   * novo entra no lugar do antigo e nada mais na aplicação muda.
   *
   * Dois casos NÃO renovam, de propósito, e a sessão expira normalmente:
   *
   * - **aba inativa** — sessão de painel financeiro não pode se manter viva
   *   sozinha numa aba esquecida em segundo plano; só renova quem está usando.
   *   Se a pessoa voltar antes do vencimento, o `visibilitychange` renova na
   *   hora — o `setTimeout` de aba oculta chega atrasado, ou não chega, quando
   *   a máquina dorme, então voltar para a aba é o gatilho confiável;
   * - **renovação que falha** (rede, API fora, teto da sessão atingido) — não
   *   derruba a sessão nem mostra erro: o token atual segue valendo até o `exp`
   *   e o efeito acima faz o encerramento de sempre. Enquanto sobrar tempo
   *   hábil, tenta de novo a cada minuto.
   */
  useEffect(() => {
    if (!token || !janela) return;
    // Cópias locais: as funções abaixo são declarações hoisted, e o TypeScript
    // não leva o estreitamento do `if` para dentro delas.
    const tokenAtual = token;
    const janelaAtual = janela;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function agendar(emMs: number) {
      if (!vivo) return;
      clearTimeout(timer);
      const espera = Math.max(0, emMs);
      // Perto demais do vencimento: o token novo nasceria quase morto e a
      // tentativa só atrasaria o encerramento. Deixa expirar.
      if (Date.now() + espera >= janelaAtual.expiraEm - MARGEM_MINIMA_RENOVACAO_MS) {
        return;
      }
      timer = setTimeout(() => void tentar(), espera);
    }

    async function tentar() {
      if (!vivo || renovando.current) return;
      // Aba oculta não renova — e não reagenda: quem retoma é o visibilitychange.
      if (document.visibilityState !== 'visible') return;
      if (!estaNaJanelaDeRenovacao(janelaAtual, Date.now())) return;
      renovando.current = true;
      try {
        const res = await api<{ accessToken?: string }>('/auth/renovar', {
          method: 'POST',
          token: tokenAtual,
        });
        // O token novo remonta este efeito, já com a janela nova.
        if (vivo && res.accessToken) guardarToken(res.accessToken);
      } catch {
        agendar(INTERVALO_RETENTATIVA_RENOVACAO_MS);
      } finally {
        renovando.current = false;
      }
    }

    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === 'visible') void tentar();
    };

    agendar(instanteRenovacao(janelaAtual) - Date.now());
    document.addEventListener('visibilitychange', aoTrocarVisibilidade);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
    };
  }, [token, janela, guardarToken]);

  /**
   * Tema NÃO pede 2FA: é preferência visual, e a rota `/auth/me/tema` aceita
   * só este campo. Antes ia pelo `PATCH /auth/me`, que exige step-up para
   * proteger telefone/nome fantasia — na prática, trocar claro/escuro pedia o
   * código do autenticador.
   */
  const patchTema = useCallback(
    async (tema: Usuario['temaPreferido']) => {
      if (!token) return;
      const updated = await api<{ temaPreferido: Usuario['temaPreferido'] }>(
        '/auth/me/tema',
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
