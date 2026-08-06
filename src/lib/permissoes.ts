/**
 * Espelho do catálogo de permissões da API (`src/shared/permissoes.ts`).
 *
 * Só os CÓDIGOS e o mapa tela → permissão ficam aqui: o painel precisa deles em
 * tempo de build para montar menu e guarda de rota. A matriz completa
 * (recurso × ação, com descrições) vem de `GET /admin/perfis/catalogo` — assim
 * a tela de cadastro de perfis nunca fica dessincronizada do backend.
 *
 * Esconder no painel é conveniência; quem barra de fato é a API (403).
 */

export const PERMISSOES = {
  DASHBOARD_VER: 'dashboard.ver',

  FATURAMENTO_VER: 'faturamento.ver',

  TRANSACOES_VER: 'transacoes.ver',
  TRANSACOES_CRIAR: 'transacoes.criar',
  /** Reenviar o callback (webhook) de uma transação da própria conta. */
  TRANSACOES_EXECUTAR: 'transacoes.executar',

  ADQUIRENTES_VER: 'adquirentes.ver',
  ADQUIRENTES_EDITAR: 'adquirentes.editar',

  CHAVES_API_VER: 'chaves_api.ver',
  CHAVES_API_CRIAR: 'chaves_api.criar',
  CHAVES_API_EDITAR: 'chaves_api.editar',
  CHAVES_API_EXCLUIR: 'chaves_api.excluir',

  WEBHOOKS_VER: 'webhooks.ver',
  WEBHOOKS_CRIAR: 'webhooks.criar',
  WEBHOOKS_EXCLUIR: 'webhooks.excluir',

  /** Apps conectados pelo lojista (Utmify e afins). */
  INTEGRACOES_VER: 'integracoes.ver',
  INTEGRACOES_CRIAR: 'integracoes.criar',
  INTEGRACOES_EDITAR: 'integracoes.editar',
  INTEGRACOES_EXCLUIR: 'integracoes.excluir',

  CHAVES_PIX_VER: 'chaves_pix.ver',
  CHAVES_PIX_CRIAR: 'chaves_pix.criar',
  CHAVES_PIX_EXCLUIR: 'chaves_pix.excluir',

  ADMIN_APROVACOES_VER: 'admin.aprovacoes.ver',
  ADMIN_APROVACOES_APROVAR: 'admin.aprovacoes.aprovar',

  ADMIN_USUARIOS_VER: 'admin.usuarios.ver',
  ADMIN_USUARIOS_EDITAR: 'admin.usuarios.editar',

  ADMIN_PERFIS_VER: 'admin.perfis.ver',
  ADMIN_PERFIS_CRIAR: 'admin.perfis.criar',
  ADMIN_PERFIS_EDITAR: 'admin.perfis.editar',
  ADMIN_PERFIS_EXCLUIR: 'admin.perfis.excluir',

  ADMIN_CHAVES_PIX_VER: 'admin.chaves_pix.ver',
  ADMIN_CHAVES_PIX_APROVAR: 'admin.chaves_pix.aprovar',

  ADMIN_MED_VER: 'admin.med.ver',
  ADMIN_MED_DECIDIR: 'admin.med.decidir',

  ADMIN_TESOURARIA_VER: 'admin.tesouraria.ver',
  ADMIN_TESOURARIA_EDITAR: 'admin.tesouraria.editar',
  ADMIN_TESOURARIA_EXECUTAR: 'admin.tesouraria.executar',

  /** Saldo das empresas dos clientes — caixa diferente do saldo nas adquirentes. */
  ADMIN_CARTEIRAS_VER: 'admin.carteiras.ver',
  /** Bloqueio administrativo de saldo (calote): bloquear, liberar e debitar. */
  ADMIN_CARTEIRAS_EXECUTAR: 'admin.carteiras.executar',

  ADMIN_CONTINGENCIA_VER: 'admin.contingencia.ver',
  ADMIN_CONTINGENCIA_EDITAR: 'admin.contingencia.editar',

  ADMIN_RELATORIOS_VER: 'admin.relatorios.ver',
  ADMIN_RELATORIOS_EDITAR: 'admin.relatorios.editar',

  ADMIN_ADQUIRENTES_VER: 'admin.adquirentes.ver',
  ADMIN_ADQUIRENTES_CRIAR: 'admin.adquirentes.criar',
  ADMIN_ADQUIRENTES_EDITAR: 'admin.adquirentes.editar',

  ADMIN_RETENCAO_VER: 'admin.retencao.ver',
  ADMIN_RETENCAO_EDITAR: 'admin.retencao.editar',

  ADMIN_MED_AUTOMATICO_VER: 'admin.med_automatico.ver',
  ADMIN_MED_AUTOMATICO_EDITAR: 'admin.med_automatico.editar',

  ADMIN_FILAS_VER: 'admin.filas.ver',
  ADMIN_FILAS_EXECUTAR: 'admin.filas.executar',

  ADMIN_AUDITORIA_VER: 'admin.auditoria.ver',

  ESCOPO_GLOBAL: 'escopo.global',
} as const;

export type CodigoPermissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

/**
 * Permissão de leitura exigida por cada rota do painel. Rotas ausentes são
 * livres para qualquer usuário autenticado (conta própria: /configuracoes,
 * /onboarding). A rota mais específica vence.
 */
export const PERMISSAO_POR_ROTA: Array<[string, CodigoPermissao]> = [
  ['/dashboard', PERMISSOES.DASHBOARD_VER],
  ['/faturamento', PERMISSOES.FATURAMENTO_VER],
  ['/transacoes', PERMISSOES.TRANSACOES_VER],
  // Mesmo extrato, outro sentido do dinheiro — mesma permissão de leitura.
  ['/transferencias', PERMISSOES.TRANSACOES_VER],
  ['/adquirentes', PERMISSOES.ADQUIRENTES_VER],
  ['/desenvolvedores/chaves', PERMISSOES.CHAVES_API_VER],
  ['/desenvolvedores/webhooks', PERMISSOES.WEBHOOKS_VER],
  ['/desenvolvedores/integracoes', PERMISSOES.INTEGRACOES_VER],
  ['/admin/aprovacoes', PERMISSOES.ADMIN_APROVACOES_VER],
  ['/admin/usuarios', PERMISSOES.ADMIN_USUARIOS_VER],
  ['/admin/perfis', PERMISSOES.ADMIN_PERFIS_VER],
  ['/admin/chaves-pix', PERMISSOES.ADMIN_CHAVES_PIX_VER],
  ['/admin/med', PERMISSOES.ADMIN_MED_VER],
  ['/admin/saldos', PERMISSOES.ADMIN_TESOURARIA_VER],
  ['/admin/carteiras', PERMISSOES.ADMIN_CARTEIRAS_VER],
  ['/admin/contingencia', PERMISSOES.ADMIN_CONTINGENCIA_VER],
  ['/admin/relatorios', PERMISSOES.ADMIN_RELATORIOS_VER],
  ['/admin/adquirentes', PERMISSOES.ADMIN_ADQUIRENTES_VER],
  ['/admin/retencao', PERMISSOES.ADMIN_RETENCAO_VER],
  ['/admin/med-automatico', PERMISSOES.ADMIN_MED_AUTOMATICO_VER],
  ['/admin/filas', PERMISSOES.ADMIN_FILAS_VER],
  ['/admin/auditoria', PERMISSOES.ADMIN_AUDITORIA_VER],
];

export function permissaoDaRota(pathname: string): CodigoPermissao | null {
  let melhor: { rota: string; codigo: CodigoPermissao } | null = null;
  for (const [rota, codigo] of PERMISSAO_POR_ROTA) {
    if (pathname !== rota && !pathname.startsWith(rota + '/')) continue;
    if (!melhor || rota.length > melhor.rota.length) melhor = { rota, codigo };
  }
  return melhor?.codigo ?? null;
}
