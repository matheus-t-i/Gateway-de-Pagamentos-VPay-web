/**
 * ESPELHO de `ESCOPOS_API` em
 * `Gateway-de-Pagamentos-VPay-api/src/shared/schemas.ts`.
 *
 * Escopo é o que a credencial PODE fazer. Toda rota da API pública chama
 * `assertEscopo` e responde 403 sem ele — então credencial sem escopo nenhum
 * não serve para nada, e é justamente isso que a tela precisa impedir.
 *
 * Os escopos são escolhidos na CRIAÇÃO e não são editáveis depois: ampliar o
 * poder de uma chave que já está circulando é criação de acesso, não ajuste de
 * cadastro (ver `editarCredencialApiSchema`). Para mudar, emite-se outra chave.
 */

export const ESCOPOS_API = {
  PIX_COBRANCA_CRIAR: 'pix.cobranca.criar',
  PIX_SAQUE_CRIAR: 'pix.saque.criar',
  TRANSACOES_LER: 'transacoes.ler',
} as const;

export type EscopoApi = (typeof ESCOPOS_API)[keyof typeof ESCOPOS_API];

export const CATALOGO_ESCOPOS: Array<{
  codigo: EscopoApi;
  rotulo: string;
  descricao: string;
}> = [
  {
    codigo: ESCOPOS_API.PIX_COBRANCA_CRIAR,
    rotulo: 'Criar cobranças',
    descricao: 'POST /v1/pix/cobrancas — gerar PIX de entrada (vendas).',
  },
  {
    codigo: ESCOPOS_API.PIX_SAQUE_CRIAR,
    rotulo: 'Criar saques',
    descricao:
      'POST /v1/pix/saques — enviar dinheiro. Exige também IPs permitidos preenchidos.',
  },
  {
    codigo: ESCOPOS_API.TRANSACOES_LER,
    rotulo: 'Consultar transações',
    descricao:
      'GET /v1/pix/transacoes/{id} — inclui dados do pagador, tarifa e liquidação.',
  },
];
