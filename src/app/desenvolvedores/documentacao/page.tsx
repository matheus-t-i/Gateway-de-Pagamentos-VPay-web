'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Shell } from '@/components/shell';
import { API_URL } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import { STATUS_CALLBACK_DOC } from '@/lib/callback-lojista';

/** Índice: âncoras das seções, na ordem em que aparecem. */
const SECOES = [
  { id: 'inicio', titulo: 'Começando' },
  { id: 'autenticacao', titulo: 'Autenticação' },
  { id: 'cobranca', titulo: 'Criar cobrança (cash-in)' },
  { id: 'saque', titulo: 'Criar saque (cash-out)' },
  { id: 'consultar', titulo: 'Consultar transação' },
  { id: 'webhooks', titulo: 'Webhooks' },
  { id: 'status', titulo: 'Status possíveis' },
  { id: 'erros', titulo: 'Erros' },
  { id: 'suporte', titulo: 'Suporte' },
];

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-ink-800/10 pt-10 dark:border-white/10">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h2>
      {descricao && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-70">{descricao}</p>
      )}
      <div className="mt-5 space-y-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

const CORES_METODO: Record<string, string> = {
  POST: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  GET: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

/** Cabeçalho de endpoint: método + caminho, copiável. */
function Endpoint({ metodo, caminho }: { metodo: 'POST' | 'GET'; caminho: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-800/10 bg-ink-800/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <span
        className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${CORES_METODO[metodo]}`}
      >
        {metodo}
      </span>
      <code className="break-all font-mono text-xs sm:text-sm">{caminho}</code>
    </div>
  );
}

function Codigo({ children, rotulo }: { children: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado: o texto continua selecionável na tela */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink-800/10 bg-ink-950 dark:border-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-sand-50/50">
          {rotulo ?? 'json'}
        </span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-sand-50/60 transition hover:bg-white/10 hover:text-sand-50"
        >
          {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiado ? 'copiado' : 'copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-sand-50">
        {children}
      </pre>
    </div>
  );
}

/** Tabela de campos/status — rola sozinha no mobile, sem estourar a página. */
function Tabela({ cabecalho, children }: { cabecalho: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-800/10 dark:border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ink-800/10 bg-ink-800/[0.03] text-xs uppercase tracking-wide opacity-60 dark:border-white/10 dark:bg-white/[0.03]">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-ink-800/5 align-top last:border-0 dark:border-white/5">
      {children}
    </tr>
  );
}

function Cel({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 ${mono ? 'whitespace-nowrap font-mono text-xs' : ''}`}>
      {children}
    </td>
  );
}

/** Destaque para regra que, se ignorada, quebra a integração. */
function Atencao({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed">
      {children}
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-ink-800/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
    {children}
  </code>
);

export default function DocumentacaoPage() {
  return (
    <Shell>
      <div className="lg:flex lg:gap-10">
        {/* Índice: coluna fixa no desktop, lista rolável no topo do mobile. */}
        <nav className="mb-8 lg:sticky lg:top-24 lg:mb-0 lg:h-fit lg:w-56 lg:shrink-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">
            Nesta página
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {SECOES.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm opacity-70 transition hover:bg-ink-800/5 hover:opacity-100 dark:hover:bg-white/5"
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <header id="inicio" className="scroll-mt-24">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Documentação da API
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed opacity-70">
              Tudo que você precisa para integrar o {BRAND.nome}: gerar cobranças PIX,
              enviar saques e receber os callbacks de cada mudança de status.
            </p>
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-50">
                Base URL
              </p>
              <code className="inline-block break-all rounded-lg border border-ink-800/10 bg-ink-800/[0.03] px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-white/[0.03]">
                {API_URL}
              </code>
            </div>
          </header>

          <div className="mt-10 space-y-10">
            <Secao
              id="autenticacao"
              titulo="Autenticação"
              descricao="Toda chamada à API pública leva o par de credenciais no header. Crie o seu em Desenvolvedores → Chaves de API."
            >
              <Codigo rotulo="headers">{`x-api-key: vp_sua_chave_publica
x-api-secret: seu_segredo`}</Codigo>
              <p>
                Em requisições <C>POST</C>, envie também <C>idempotency-key</C> (um UUID
                por operação). É o que garante que uma retentativa sua — timeout de rede,
                por exemplo — não crie a mesma cobrança duas vezes.
              </p>
            </Secao>

            <Secao
              id="cobranca"
              titulo="Criar cobrança PIX (cash-in)"
              descricao="Gera o código copia-e-cola para o seu cliente pagar."
            >
              <Endpoint metodo="POST" caminho={`${API_URL}/v1/pix/cobrancas`} />
              <Codigo>{`{
  "valor": "150.00",
  "referenciaExterna": "pedido-123",
  "pagador": {
    "nome": "Fulano de Tal",
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
    { "titulo": "Frete",    "quantidade": 1, "valorUnitario": 20.00, "tangivel": false }
  ],
  "rastreio": {
    "utm_source": "facebook",
    "utm_campaign": "black-friday",
    "utm_medium": "cpc",
    "utm_content": "criativo-03",
    "utm_term": "camiseta",
    "src": null,
    "sck": null
  },
  "urlCallback": "https://seusite.com/webhooks/pedido-123",
  "expiracaoSegundos": 3600
}`}</Codigo>

              <Tabela cabecalho={['Campo', 'Regra']}>
                <Linha>
                  <Cel mono>itens</Cel>
                  <Cel>
                    Obrigatório, no mínimo 1. Cada item exige <C>titulo</C>,{' '}
                    <C>quantidade</C>, <C>valorUnitario</C> e <C>tangivel</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.endereco</Cel>
                  <Cel>
                    Obrigatório se <strong>qualquer</strong> item for <C>tangivel: true</C>{' '}
                    (produto físico precisa de entrega). Sem ele a cobrança é recusada
                    com <C>400</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>valor</Cel>
                  <Cel>
                    Não precisa ser igual à soma dos itens — frete, desconto e acréscimo
                    podem ficar fora.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.nome / pagador.email</Cel>
                  <Cel>
                    Opcionais para o PIX, <strong>obrigatórios</strong> se você usa
                    Integrações: os apps de rastreio exigem nome e e-mail do comprador e
                    recusam o pedido sem eles.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>urlCallback</Cel>
                  <Cel>
                    Opcional. Quando presente, esta cobrança notifica também essa URL
                    (veja <a className="text-accent underline" href="#webhooks">Webhooks</a>).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>rastreio</Cel>
                  <Cel>
                    Opcional. Origem da venda (<C>utm_source</C>, <C>utm_campaign</C>,{' '}
                    <C>utm_medium</C>, <C>utm_content</C>, <C>utm_term</C>, <C>src</C>,{' '}
                    <C>sck</C>). Não altera nada no PIX: é repassado aos apps que você
                    conectou em{' '}
                    <a className="text-accent underline" href="/desenvolvedores/integracoes">
                      Integrações
                    </a>{' '}
                    para atribuir a venda à campanha que a gerou. Envie o que o seu
                    checkout capturou da URL do anúncio — sem isso a venda chega no app
                    sem origem.
                  </Cel>
                </Linha>
              </Tabela>

              <p>
                A resposta traz o <C>idTransacao</C>, o copia-e-cola e a situação{' '}
                <C>AGUARDANDO_PAGAMENTO</C>.
              </p>
            </Secao>

            <Secao
              id="saque"
              titulo="Criar saque PIX (cash-out)"
              descricao="Envia dinheiro da sua carteira para uma chave PIX."
            >
              <Endpoint metodo="POST" caminho={`${API_URL}/v1/pix/saques`} />
              <Codigo>{`{
  "valor": "80.00",
  "chavePix": "12345678900",
  "tipoChavePix": "CPF",
  "nomeBeneficiario": "Bruno de Tal",
  "documentoBeneficiario": "12345678900",
  "referenciaExterna": "saque-55",
  "urlCallback": "https://seusite.com/webhooks/saque-55"
}`}</Codigo>

              <Tabela cabecalho={['Campo', 'Obrigatório', 'Regra']}>
                <Linha>
                  <Cel mono>valor</Cel>
                  <Cel>sim</Cel>
                  <Cel>String com até 2 casas decimais.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>chavePix</Cel>
                  <Cel>sim</Cel>
                  <Cel>A chave que vai receber o dinheiro.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>tipoChavePix</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    <C>CPF</C>, <C>CNPJ</C>, <C>EMAIL</C>, <C>TELEFONE</C> ou{' '}
                    <C>ALEATORIA</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>nomeBeneficiario</Cel>
                  <Cel>sim</Cel>
                  <Cel>Nome de quem é dono da chave.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>documentoBeneficiario</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    CPF (11) ou CNPJ (14) <strong>do dono da chave PIX</strong>. Aceita
                    com ou sem máscara.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>referenciaExterna</Cel>
                  <Cel>não</Cel>
                  <Cel>Seu identificador do saque, devolvido no callback.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>urlCallback</Cel>
                  <Cel>não</Cel>
                  <Cel>Destino extra para o callback desta operação.</Cel>
                </Linha>
              </Tabela>

              <Atencao>
                <strong>
                  O <C>documentoBeneficiario</C> tem que ser o do titular da chave PIX.
                </strong>{' '}
                A liquidante confere o documento contra o dono da chave no DICT e recusa
                o PIX quando não bate — o saque falha depois de já ter debitado o seu
                saldo. Quando <C>tipoChavePix</C> é <C>CPF</C> ou <C>CNPJ</C>, o
                documento precisa ser <strong>igual à própria chave</strong>; se
                divergir, recusamos na hora com <C>400</C>, antes de qualquer débito.
              </Atencao>

              <Atencao>
                Saque via API exige o escopo <C>pix.saque.criar</C> na credencial{' '}
                <strong>e</strong> a lista de IPs liberados preenchida. É uma operação
                que tira dinheiro da conta: sem IP allowlist, ela não sai.
              </Atencao>

              <p>
                Pelo painel o fluxo é outro: você não digita a chave. O saque só usa
                chave <strong>cadastrada e aprovada</strong> pelo administrador, e o
                nome/documento do beneficiário vêm desse cadastro — se a chave estiver
                sem esses dados, o saque é recusado até o cadastro ser completado.
              </p>
              <p>
                A resposta traz o <C>idTransacao</C> e a situação{' '}
                <C>PROCESSANDO</C> — nesse momento o valor{' '}
                <strong>já saiu</strong> do seu saldo.
              </p>
            </Secao>

            <Secao
              id="consultar"
              titulo="Consultar transação"
              descricao="Estado atual de uma operação, a qualquer momento."
            >
              <Endpoint
                metodo="GET"
                caminho={`${API_URL}/v1/pix/transacoes/{idTransacao}`}
              />
              <p>
                Use como rede de segurança da sua conciliação — nunca como substituto do
                webhook para liberar pedido.
              </p>
            </Secao>

            <Secao
              id="webhooks"
              titulo="Webhooks (callbacks)"
              descricao="Avisamos seu sistema a cada mudança de status da operação."
            >
              <p>
                Existem <strong>dois caminhos</strong> para receber, e você pode usar os
                dois ao mesmo tempo:
              </p>
              <Tabela cabecalho={['Caminho', 'Como funciona']}>
                <Linha>
                  <Cel>
                    <strong>Cadastro no painel</strong>
                  </Cel>
                  <Cel>
                    Em Desenvolvedores → Webhooks. Vale para todas as operações da conta e
                    é o único que leva o header de validação de origem.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel>
                    <strong>Por operação</strong>
                  </Cel>
                  <Cel>
                    O campo <C>urlCallback</C> na criação da cobrança ou do saque, para
                    quando cada pedido tem um destino diferente.
                  </Cel>
                </Linha>
              </Tabela>
              <Atencao>
                Com os dois configurados, <strong>enviamos para os dois</strong> — ou seja,
                o mesmo evento chega <strong>duas vezes</strong>, uma em cada URL. Trate o
                callback de forma idempotente usando o <C>idTransacao</C>. Se a{' '}
                <C>urlCallback</C> apontar para a mesma URL de um webhook cadastrado, aí a
                entrega sai uma vez só (barra final e maiúsculas no domínio não contam
                como URLs diferentes).
              </Atencao>

              <p className="pt-2 font-medium">Corpo enviado — cash-in</p>
              <Codigo>{`{
  "usuario": "bitflow",
  "referencia_externa": "019fd4d9-ac10-7067-b75e-63b952095fed",
  "valor_bruto": 26.1,
  "nome": "ILZA MARIA PEIXOTO PONTES",
  "documento": "48000590700",
  "email": "mayene54@gmail.com",
  "data_registro": "2026-08-05 20:14:23",
  "status": "CONCLUIDA",
  "idTransacao": "88dcc992-784c-9e87-8630-b2b9a692f2aa",
  "endToEnd": "E08561701202608060214XGESEFBZNK6",
  "codigo_pagamento": "00020126850014br.gov.bcb.pix2563...63047D77",
  "paymentCodeBase64": "MDAwMjAxMjY4NTAwMTRici5nb3YuYmNiLnBpeDI1NjNw...",
  "deposito_liquido": "25.06",
  "data_med": null,
  "urlcallback": "https://api.seusite.com/webhooks/vpay",
  "operacao": "cash_in"
}`}</Codigo>

              <p className="pt-2 font-medium">Corpo enviado — cash-out</p>
              <Codigo>{`{
  "usuario": "payshark",
  "referencia_externa": "1a0286c6-c128-4cfe-98d2-b8c816708cb2",
  "valor_bruto": 205,
  "nome": "SHARK PARTNER NEGOCIOS DIGITAIS LTDA",
  "documento": "34300033000179",
  "data_registro": "2026-08-03 11:40:04",
  "status": "CONCLUIDA",
  "idTransacao": "23723894-1c0a-4f3b-9d21-77aa10bb2f04",
  "endToEnd": "E3729393020260803174002770d7ed7f",
  "valor_liquidado": "200.00",
  "data_med": null,
  "urlcallback": "https://app.seusite.com.br/api/webhook/",
  "operacao": "cash_out"
}`}</Codigo>

              <Tabela cabecalho={['Campo', 'Descrição']}>
                <Linha>
                  <Cel mono>usuario</Cel>
                  <Cel>Nome fantasia da sua conta no gateway.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>referencia_externa</Cel>
                  <Cel>
                    O <C>referenciaExterna</C> que você enviou na criação — use-o para
                    achar o pedido do seu lado.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>valor_bruto</Cel>
                  <Cel>Valor da operação, em número.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>nome / documento</Cel>
                  <Cel>
                    A contraparte: quem pagou (cash-in) ou quem recebeu (cash-out).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>email</Cel>
                  <Cel>Só em cash-in: e-mail do pagador, quando informado.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>data_registro</Cel>
                  <Cel>
                    Criação da operação, <C>YYYY-MM-DD HH:mm:ss</C> no horário de Brasília.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>status</Cel>
                  <Cel>
                    Estado atual — veja{' '}
                    <a className="text-accent underline" href="#status">
                      todos os status
                    </a>
                    .
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>idTransacao</Cel>
                  <Cel>Identificador da operação no gateway. Use como chave de idempotência.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>endToEnd</Cel>
                  <Cel>
                    Identificador fim-a-fim do PIX, o mesmo que aparece no extrato
                    bancário. Nulo enquanto a operação não liquidou.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>codigo_pagamento</Cel>
                  <Cel>Só em cash-in: o copia-e-cola da cobrança.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>paymentCodeBase64</Cel>
                  <Cel>Só em cash-in: o mesmo copia-e-cola em Base64.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>deposito_liquido</Cel>
                  <Cel>Só em cash-in: quanto entrou na sua carteira, já sem a tarifa.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>valor_liquidado</Cel>
                  <Cel>
                    Só em cash-out: quanto saiu da sua carteira (valor do saque + tarifa).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>data_med</Cel>
                  <Cel>
                    <C>null</C> normalmente. Preenchida quando a operação recebeu uma
                    contestação (MED) — chega junto do status <C>REFUNDED</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>urlcallback</Cel>
                  <Cel>A URL para a qual esta entrega foi feita.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>operacao</Cel>
                  <Cel>
                    <C>cash_in</C> (entrou dinheiro) ou <C>cash_out</C> (saiu).
                  </Cel>
                </Linha>
              </Tabela>

              <p className="pt-2 font-medium">Validando a origem</p>
              <p>
                No cadastro do webhook você define um <strong>header de validação</strong>{' '}
                — o nome (ex.: <C>x-key-token</C>) e o valor são seus. Confira nome e valor
                antes de processar e rejeite o que não bater. Guardamos o valor cifrado e
                nunca o devolvemos pela API.
              </p>
              <Atencao>
                Esse header vale <strong>somente</strong> para os webhooks cadastrados no
                painel. Entregas na <C>urlCallback</C> da operação vão{' '}
                <strong>sem header</strong>: a credencial é do cadastro e não seria seguro
                repassá-la para uma URL informada solta na criação do PIX. Se você precisa
                de origem validada, cadastre o webhook no painel.
              </Atencao>

              <p className="pt-2 font-medium">Entrega e retentativas</p>
              <p>
                Responda <C>2xx</C> para confirmar. Entregas com falha são retentadas com
                backoff exponencial, e um destino fora do ar não impede a entrega no outro.
                Você também pode reenviar manualmente qualquer callback pelo botão{' '}
                <strong>Reenviar</strong> na tela de Transações.
              </p>
            </Secao>

            <Secao
              id="status"
              titulo="Status possíveis"
              descricao="O campo status traz a situação da transação — o mesmo valor que você vê no painel. A lista é fechada e cada sentido usa só um subconjunto dela."
            >
              <Tabela cabecalho={['Status', 'Operação', 'Final?', 'Quando chega']}>
                {STATUS_CALLBACK_DOC.map((s) => (
                  <Linha key={s.status}>
                    <Cel mono>{s.status}</Cel>
                    <Cel mono>{s.operacoes.join(', ')}</Cel>
                    <Cel>
                      <span
                        className={
                          s.terminal
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'opacity-60'
                        }
                      >
                        {s.terminal ? 'sim' : 'não'}
                      </span>
                    </Cel>
                    <Cel>{s.descricao}</Cel>
                  </Linha>
                ))}
              </Tabela>
              <Atencao>
                Libere o pedido apenas em <C>CONCLUIDA</C> com <C>operacao: cash_in</C>.
                Status não-final ainda pode mudar, e <C>MED</C> chega quando o pagador
                contesta a compra — nesse caso, estorne.
              </Atencao>

              <p className="pt-2 font-medium">Rota de uma cobrança (cash-in)</p>
              <Codigo rotulo="fluxo">{`criada  ──▶  AGUARDANDO_PAGAMENTO ──▶  CONCLUIDA  ──▶  MED
                       │                          (só se o pagador contestar)
                       │
                       └─ liquidante falhou? a contingência gera em outra e o
                          status CONTINUA AGUARDANDO_PAGAMENTO (só mudam os
                          dados da liquidante: código PIX, txid).
                          Esgotaram todas ──▶ FALHA`}</Codigo>
              <p>
                A cobrança <strong>já nasce</strong> <C>AGUARDANDO_PAGAMENTO</C>: não
                existe <C>PENDENTE</C> nem <C>PROCESSANDO</C> em cash-in, e ela nunca é{' '}
                <C>CANCELADA</C> — o que não foi gerado vira <C>FALHA</C>.
              </p>

              <p className="pt-2 font-medium">Rota de um saque (cash-out)</p>
              <Codigo rotulo="fluxo">{`criado ──▶ PROCESSANDO ──▶ CONCLUIDA
                  │              (confirmado na liquidante)
                  │
                  ├──▶ FALHA
                  └──▶ CANCELADA`}</Codigo>
              <p>
                Em <C>PROCESSANDO</C> o saldo <strong>já saiu</strong> da sua carteira: o
                débito acontece na criação do saque, não na confirmação.
              </p>

              <p className="pt-2">
                A lista é estável: novos valores podem ser{' '}
                <strong>acrescentados</strong> no futuro, mas os existentes não mudam de
                nome nem de significado. Ainda assim, escreva seu tratamento com um{' '}
                <C>default</C> que apenas registra o status desconhecido em vez de quebrar.
              </p>
            </Secao>

            <Secao
              id="erros"
              titulo="Erros"
              descricao="Todo erro volta em JSON com message legível."
            >
              <Tabela cabecalho={['Código', 'Significado']}>
                <Linha>
                  <Cel mono>400</Cel>
                  <Cel>Payload inválido (campo faltando, valor fora do permitido).</Cel>
                </Linha>
                <Linha>
                  <Cel mono>401</Cel>
                  <Cel>Credenciais ausentes ou inválidas.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>403</Cel>
                  <Cel>
                    Credencial sem o escopo necessário, ou IP fora da allowlist.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>404</Cel>
                  <Cel>Transação não encontrada nesta conta.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>429</Cel>
                  <Cel>Limite de requisições excedido — reduza o ritmo e repita.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>503</Cel>
                  <Cel>
                    Nenhuma adquirente conseguiu gerar a cobrança. Pode repetir com a
                    mesma <C>idempotency-key</C>.
                  </Cel>
                </Linha>
              </Tabela>
            </Secao>

            <Secao id="suporte" titulo="Suporte">
              <p>
                Dúvidas de integração:{' '}
                <a className="text-accent underline" href={`mailto:${BRAND.email}`}>
                  {BRAND.email}
                </a>{' '}
                · WhatsApp{' '}
                <a
                  className="text-accent underline"
                  href={BRAND.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {BRAND.whatsapp}
                </a>
              </p>
            </Secao>
          </div>
        </div>
      </div>
    </Shell>
  );
}
