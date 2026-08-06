/**
 * ESPELHO de `Gateway-de-Pagamentos-VPay-api/src/shared/integracoes.ts`.
 *
 * Vocabulário dos apps que o lojista conecta na conta
 * (`/desenvolvedores/integracoes`). A tela é desenhada a partir do
 * `CATALOGO_INTEGRACOES` — app novo entra no arquivo da API, é copiado para cá
 * e aparece na tela sem markup novo.
 *
 * O catálogo carrega CAPACIDADES por app (`credencial`, `suportaTeste`) porque
 * os apps não funcionam do mesmo jeito: a Utmify exige um token e valida envio
 * de teste; a Xtracky não tem credencial nenhuma e trata todo envio como real.
 */

export const TIPO_INTEGRACAO = {
  UTMIFY: 'UTMIFY',
  XTRACKY: 'XTRACKY',
} as const;
export type TipoIntegracaoValor =
  (typeof TIPO_INTEGRACAO)[keyof typeof TIPO_INTEGRACAO];

/** Eventos que o lojista assina por integração. Lista vazia = todos. */
export const EVENTOS_INTEGRACAO = {
  PEDIDO_CRIADO: 'pedido.criado',
  PEDIDO_PAGO: 'pedido.pago',
  PEDIDO_DEVOLVIDO: 'pedido.devolvido',
} as const;
export type EventoIntegracao =
  (typeof EVENTOS_INTEGRACAO)[keyof typeof EVENTOS_INTEGRACAO];

export const ROTULO_EVENTO_INTEGRACAO: Record<EventoIntegracao, string> = {
  [EVENTOS_INTEGRACAO.PEDIDO_CRIADO]: 'PIX gerado',
  [EVENTOS_INTEGRACAO.PEDIDO_PAGO]: 'Pago',
  [EVENTOS_INTEGRACAO.PEDIDO_DEVOLVIDO]: 'Devolvido (MED)',
};

export const TODOS_EVENTOS_INTEGRACAO: EventoIntegracao[] =
  Object.values(EVENTOS_INTEGRACAO);

/** `status` do pedido no app de destino — vocabulário DELES, não traduzir. */
export const STATUS_REMOTO_PEDIDO = {
  WAITING_PAYMENT: 'waiting_payment',
  PAID: 'paid',
  REFUNDED: 'refunded',
} as const;
export type StatusRemotoPedido =
  (typeof STATUS_REMOTO_PEDIDO)[keyof typeof STATUS_REMOTO_PEDIDO];

/** Situações de `envios_integracao` (histórico de envio ao app). */
export const SITUACAO_ENVIO_INTEGRACAO = {
  PENDENTE: 'PENDENTE',
  SUCESSO: 'SUCESSO',
  FALHA: 'FALHA',
} as const;

/** Parâmetros de rastreio aceitos no bloco `rastreio` da cobrança. */
export const CAMPOS_RASTREIO = [
  'utm_source',
  'utm_campaign',
  'utm_medium',
  'utm_content',
  'utm_term',
  'src',
  'sck',
] as const;

export type AppIntegracao = {
  tipo: TipoIntegracaoValor;
  nome: string;
  /** Uma linha: o que o app faz. Aparece no card da vitrine. */
  resumo: string;
  descricao: string;
  site: string;
  /**
   * Arquivo da marca em `public/apps/`. Ausente → o card usa o monograma
   * colorido; basta soltar o arquivo oficial na pasta para trocar.
   */
  logo: string;
  /** Cor da marca: fundo do monograma e realce do card. */
  corMarca: string;
  /** `null` = o app não tem credencial (o formulário esconde o campo). */
  credencial: { rotulo: string; ondeObter: string } | null;
  /** `false` = sem "modo teste" e sem botão "Testar": todo envio é real. */
  suportaTeste: boolean;
  eventos: EventoIntegracao[];
  /** Marcados por padrão ao conectar. Vazio = todos os `eventos`. */
  eventosPadrao: EventoIntegracao[];
  /** Aviso mostrado no formulário. */
  observacao?: string;
};

export const CATALOGO_INTEGRACOES: AppIntegracao[] = [
  {
    tipo: TIPO_INTEGRACAO.UTMIFY,
    nome: 'Utmify',
    resumo: 'Rastreio de campanha e ROI de tráfego pago',
    descricao:
      'Envia suas vendas para a Utmify com os parâmetros de campanha, para medir o ROI real de cada anúncio.',
    site: 'https://utmify.com.br',
    logo: '/apps/utmify.svg',
    corMarca: '#7C3AED',
    credencial: {
      rotulo: 'Credencial de API (x-api-token)',
      ondeObter:
        'Utmify → Integrações → Webhooks → Credenciais de API → Adicionar credencial',
    },
    suportaTeste: true,
    eventos: TODOS_EVENTOS_INTEGRACAO,
    eventosPadrao: TODOS_EVENTOS_INTEGRACAO,
  },
  {
    tipo: TIPO_INTEGRACAO.XTRACKY,
    nome: 'Xtracky',
    resumo: 'Conversões e otimização de campanha por LeadId',
    descricao:
      'Envia suas vendas para a Xtracky usando o LeadId que o script dela injeta na URL, para atribuir a conversão à campanha e alimentar a otimização dos anúncios.',
    site: 'https://xtracky.com',
    logo: '/apps/xtracky.svg',
    corMarca: '#0EA5E9',
    credencial: null,
    suportaTeste: false,
    eventos: TODOS_EVENTOS_INTEGRACAO,
    eventosPadrao: [EVENTOS_INTEGRACAO.PEDIDO_PAGO],
    observacao:
      'A Xtracky identifica a venda pelo LeadId que o script dela grava em utm_source (e em sck) — então a cobrança precisa ser criada com o bloco `rastreio`. Marcar mais de um evento pode fazer a Xtracky descartar os seguintes: o dedupe dela é por pedido + LeadId, sem considerar o status.',
  },
];

export function appIntegracao(tipo: string): AppIntegracao | undefined {
  return CATALOGO_INTEGRACOES.find((a) => a.tipo === tipo);
}

/** Eventos marcados ao conectar um app. */
export function eventosPadraoDoApp(tipo: string): EventoIntegracao[] {
  const app = appIntegracao(tipo);
  if (!app) return TODOS_EVENTOS_INTEGRACAO;
  return app.eventosPadrao.length ? app.eventosPadrao : app.eventos;
}
