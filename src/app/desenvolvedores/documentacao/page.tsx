'use client';

import { Shell } from '@/components/shell';
import { API_URL } from '@/lib/api';
import { BRAND } from '@/lib/brand';

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{titulo}</h2>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </section>
  );
}

function Codigo({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-ink-800/10 bg-ink-950 p-4 font-mono text-xs leading-relaxed text-sand-50 dark:border-white/10">
      {children}
    </pre>
  );
}

export default function DocumentacaoPage() {
  return (
    <Shell>
      <h1 className="font-display text-3xl font-semibold">Documentação da API</h1>
      <p className="mt-1 text-sm opacity-70">
        Referência rápida para integrar com o {BRAND.nome}. Base URL:{' '}
        <code className="font-mono">{API_URL}</code>
      </p>

      <Bloco titulo="Autenticação">
        <p>
          Toda chamada à API pública leva o par de credenciais no header (crie em
          Desenvolvedores → Chaves de API):
        </p>
        <Codigo>{`x-api-key: vp_sua_chave_publica
x-api-secret: seu_segredo`}</Codigo>
        <p>
          Recomendado: envie também <code className="font-mono">idempotency-key</code>{' '}
          (UUID) em POSTs para evitar duplicidade em retentativas.
        </p>
      </Bloco>

      <Bloco titulo="Criar cobrança PIX (cash-in)">
        <Codigo>{`POST ${API_URL}/v1/pix/cobrancas
Content-Type: application/json
x-api-key: ...
x-api-secret: ...
idempotency-key: 5c1f...

{
  "valor": "150.00",
  "referenciaExterna": "pedido-123",
  "pagador": {
    "nome": "Fulano",
    "documento": "12345678900",
    "email": "fulano@email.com",
    "endereco": {
      "cep": "01001000",
      "logradouro": "Praça da Sé",
      "numero": "10",
      "complemento": "sala 2",
      "bairro": "Sé",
      "cidade": "São Paulo",
      "uf": "SP"
    }
  },
  "itens": [
    { "titulo": "Camiseta", "quantidade": 2, "valorUnitario": 65.00, "tangivel": true },
    { "titulo": "Frete", "quantidade": 1, "valorUnitario": 20.00, "tangivel": false }
  ],
  "urlCallback": "https://seusite.com/webhooks/pedido-123",
  "expiracaoSegundos": 3600
}`}</Codigo>
        <p>
          <strong>itens</strong> é obrigatório (ao menos 1). Cada item exige{' '}
          <code className="font-mono">titulo</code>,{' '}
          <code className="font-mono">quantidade</code>,{' '}
          <code className="font-mono">valorUnitario</code> e{' '}
          <code className="font-mono">tangivel</code>.
        </p>
        <p>
          Se <strong>qualquer item</strong> tiver{' '}
          <code className="font-mono">tangivel: true</code> (produto físico), o{' '}
          <code className="font-mono">pagador.endereco</code> passa a ser
          obrigatório — sem ele a cobrança é recusada com 400.
        </p>
        <p>
          O <code className="font-mono">valor</code> da cobrança não precisa ser
          igual à soma dos itens: frete, desconto e acréscimo podem ficar fora.
        </p>
        <p>
          <code className="font-mono">urlCallback</code> é opcional: quando
          presente, esta cobrança notifica também essa URL (veja Webhooks).
        </p>
        <p>
          Resposta: transação com <code className="font-mono">idTransacao</code>, QR
          Code (copia-e-cola) e situação{' '}
          <code className="font-mono">AGUARDANDO_PAGAMENTO</code>.
        </p>
      </Bloco>

      <Bloco titulo="Criar saque PIX (cash-out)">
        <Codigo>{`POST ${API_URL}/v1/pix/saques
x-api-key / x-api-secret / idempotency-key

{
  "valor": "80.00",
  "chavePix": "fulano@email.com",
  "tipoChavePix": "EMAIL",
  "referenciaExterna": "saque-55",
  "urlCallback": "https://seusite.com/webhooks/saque-55"
}`}</Codigo>
        <p>
          Saque via API exige o escopo{' '}
          <code className="font-mono">pix.saque.criar</code> e IPs liberados na
          credencial.
        </p>
      </Bloco>

      <Bloco titulo="Consultar transação">
        <Codigo>{`GET ${API_URL}/v1/pix/transacoes/{idTransacao}
x-api-key / x-api-secret`}</Codigo>
      </Bloco>

      <Bloco titulo="Webhooks (callbacks)">
        <p>
          Existem <strong>dois caminhos</strong> para receber a notificação, e você
          pode usar os dois ao mesmo tempo:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Cadastro fixo</strong> em Desenvolvedores → Webhooks: vale para
            todas as operações da empresa.
          </li>
          <li>
            <strong>Por operação</strong>: o campo{' '}
            <code className="font-mono">urlCallback</code> na criação da cobrança ou
            do saque, útil quando cada pedido tem um destino diferente.
          </li>
        </ul>
        <p>
          Com os dois configurados, enviamos para os dois. Se a{' '}
          <code className="font-mono">urlCallback</code> for igual à URL de um
          webhook cadastrado, a entrega sai <strong>uma vez só</strong> — barra final
          e diferença de maiúsculas no domínio não contam como URLs diferentes.
        </p>

        <p className="pt-2 font-medium">Corpo enviado</p>
        <Codigo>{`POST https://seusite.com/webhooks/vpay
Content-Type: application/json
x-key-token: (só nos webhooks cadastrados no painel, se você configurou o header)

{
  "tipoEvento": "pix.cashin.pago",
  "idTransacao": "uuid-da-transacao",
  "dados": {
    "idTransacao": "uuid-da-transacao",
    "valor": "150.00",
    "situacao": "CONCLUIDA"
  },
  "ocorridoEm": "2026-08-01T12:00:00Z"
}`}</Codigo>

        <p className="pt-2 font-medium">Eventos</p>
        <Codigo>{`pix.cashin.pago            cobrança paga e creditada
pix.cashout.concluido      saque concluído na adquirente
pix.cashout.falhou         saque recusado/falhou
pix.devolucao.concluida    devolução (MED) efetivada`}</Codigo>
        <p>
          No cadastro do webhook você escolhe quais desses eventos quer receber.
          A <code className="font-mono">urlCallback</code> da operação recebe os
          mesmos eventos assinados no cadastro.
        </p>

        <p className="pt-2 font-medium">Validando a origem</p>
        <p>
          No cadastro do webhook você pode definir um{' '}
          <strong>header de validação</strong> — o nome (ex.:{' '}
          <code className="font-mono">x-key-token</code>) e o valor são seus.
          Confira nome e valor antes de processar e rejeite o que não bater.
        </p>
        <p>
          Esse header vale <strong>somente</strong> para os webhooks cadastrados no
          painel. Callbacks enviados para a{' '}
          <code className="font-mono">urlCallback</code> da operação vão{' '}
          <strong>sem header de autenticação</strong>: a credencial é do cadastro e
          não seria seguro repassá-la para uma URL informada solta na criação do
          PIX. Se você precisa de origem validada, cadastre o webhook no painel.
        </p>
        <p>
          Guardamos o valor cifrado e nunca o devolvemos pela API — a listagem
          mostra só qual header está configurado.
        </p>

        <p className="pt-2">
          Entregas com falha são retentadas com backoff exponencial. Responda{' '}
          <code className="font-mono">2xx</code> para confirmar o recebimento; um
          destino fora do ar não impede a entrega no outro.
        </p>
      </Bloco>

      <Bloco titulo="Suporte">
        <p>
          Dúvidas de integração:{' '}
          <a className="text-accent underline" href={`mailto:${BRAND.email}`}>
            {BRAND.email}
          </a>{' '}
          · WhatsApp{' '}
          <a className="text-accent underline" href={BRAND.whatsappLink} target="_blank" rel="noreferrer">
            {BRAND.whatsapp}
          </a>
        </p>
      </Bloco>
    </Shell>
  );
}
