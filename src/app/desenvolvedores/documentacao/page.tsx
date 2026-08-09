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
              descricao="Em duas etapas: troque o seu par de credenciais por um token de acesso e envie o token em toda chamada. Crie as credenciais em Desenvolvedores → Chaves de API."
            >
              <p className="font-medium">1. Gere o token de acesso</p>
              <p>
                O par <C>x-api-key</C>/<C>x-api-secret</C> entra{' '}
                <strong>somente aqui</strong> — nenhuma outra rota o aceita.
              </p>
              <Endpoint metodo="POST" caminho={`${API_URL}/v1/auth/token`} />
              <Codigo rotulo="curl">{`curl -X POST ${API_URL}/v1/auth/token \\
  -H "x-api-key: vp_sua_chave_publica" \\
  -H "x-api-secret: seu_segredo"`}</Codigo>
              <Codigo rotulo="resposta">{`{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "escopos": ["pix.cobranca.criar", "transacoes.ler"]
}`}</Codigo>
              <p>
                O token vale por <C>expires_in</C> segundos (1 hora).{' '}
                <strong>Guarde-o e reutilize</strong> em todas as chamadas até expirar —
                não gere um token novo a cada requisição: a emissão tem teto próprio de
                tentativas por chave.
              </p>

              <p className="pt-2 font-medium">2. Chame a API com o token</p>
              <Codigo rotulo="headers">{`Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json`}</Codigo>
              <Atencao>
                <strong>Token expirado ou inválido responde 401</strong> — a única saída
                é gerar um novo em <C>POST /v1/auth/token</C>. Trate o <C>401</C> no seu
                cliente: reemita o token e repita a chamada uma vez. E a validade do
                token <strong>não prolonga o acesso</strong>: credencial revogada ou
                conta bloqueada derrubam o token na hora, porque cada requisição
                reconfere a credencial no gateway.
              </Atencao>

              <p>
                Os exemplos de chamada (cURL) estão em cada seção:{' '}
                <a className="text-accent underline" href="#cobranca">cobrança</a>,{' '}
                <a className="text-accent underline" href="#saque">saque</a> e{' '}
                <a className="text-accent underline" href="#consultar">consulta</a> —
                todos usando <C>Authorization: Bearer</C>.
              </p>

              <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
                <p className="font-medium">Coleção do Postman</p>
                <p className="mt-1 text-sm opacity-80">
                  Todas as chamadas acima já montadas. Baixe, importe no Postman (
                  <strong>File → Import</strong>) e preencha <C>baseUrl</C>,{' '}
                  <C>apiKey</C> e <C>apiSecret</C> na aba <strong>Variables</strong>.
                  Rode <strong>Gerar token de acesso</strong> primeiro: ele salva o{' '}
                  <C>accessToken</C> na coleção e as demais requisições o usam
                  automaticamente.
                </p>
                <a
                  href="/vpay-api.postman_collection.json"
                  download
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                >
                  Baixar coleção (.json)
                </a>
              </div>

              <Atencao>
                <strong>A chave precisa ter permissões (escopos).</strong> Cada rota exige
                a sua: <C>pix.cobranca.criar</C> para criar cobrança,{' '}
                <C>pix.saque.criar</C> para saque e <C>transacoes.ler</C> para consultar.
                Uma chave sem permissão responde <C>403</C> em <strong>tudo</strong>. As
                permissões são escolhidas na criação e <strong>não podem ser alteradas
                depois</strong> — para mudar, emita outra chave e revogue a antiga.
              </Atencao>

              <p>
                <strong>IPs permitidos.</strong> Deixar a lista vazia libera qualquer
                origem. Preenchida, aceita IP exato ou faixa CIDR (
                <C>203.0.113.10</C>, <C>198.51.100.0/24</C>, <C>2804:14c::/64</C>) e
                recusa o resto com <C>403</C>. Para <a className="text-accent underline" href="#saque">saque</a>{' '}
                a lista é <strong>obrigatória</strong>.
              </p>

              <p>
                <strong>Limite de requisições:</strong> 60 por minuto por credencial. O
                contador é <strong>compartilhado</strong> entre criar cobrança, criar
                saque e consultar — não é um limite por rota. Estourou, as chamadas
                seguintes falham até a janela virar.
              </p>

              <p>
                <strong>Idempotência: mande a sua <C>referenciaExterna</C>.</strong>{' '}
                Informe o id do pedido do SEU sistema na criação da cobrança ou do
                saque. Se a chamada cair por timeout e você repetir com a{' '}
                <strong>mesma referência e os mesmos dados</strong>, devolvemos a{' '}
                <strong>mesma operação</strong> (mesmo <C>idTransacao</C>, mesmo código
                PIX) — nada é criado nem debitado de novo. A resposta vem com a
                situação <strong>atual</strong> da operação, que pode já ter avançado
                (ex.: <C>CONCLUIDA</C>).
              </p>
              <Atencao>
                <strong>Cobrança nunca responde 409 pela referência.</strong> A mesma{' '}
                <C>referenciaExterna</C> com qualquer dado diferente (valor, pagador,
                itens) gera uma <strong>cobrança nova</strong> — o pedido mudou, e o
                seu cliente sempre sai com um QR válido. O mesmo acontece quando a
                cobrança anterior falhou ou o QR expirou. Só repare: se o QR anterior
                chegou a ser exibido, ele continua pagável até expirar — distinga o
                callback de cada cobrança pelo <C>idTransacao</C>. No{' '}
                <strong>saque</strong> a regra é mais dura de propósito: mesma
                referência com dado diferente responde <C>409</C> — dinheiro saindo
                não ganha segunda ordem automática.
              </Atencao>

              <p>
                Credencial revogada, inativa ou expirada não gera token (<C>401</C> no{' '}
                <C>/v1/auth/token</C>) <strong>e</strong> derruba na hora os tokens que
                já existiam. Conta encerrada, suspensa ou bloqueada responde{' '}
                <C>403</C> — mesmo com credencial e token corretos.
              </p>

              <p className="pt-2 font-medium">Trocando o segredo sem parar de vender</p>
              <p>
                Em <strong>Desenvolvedores → Chaves de API</strong>, o botão{' '}
                <strong>Rotacionar segredo</strong> gera um segredo novo e mantém o
                antigo funcionando por <strong>7 dias</strong>. A{' '}
                <C>x-api-key</C> não muda — você troca só o <C>x-api-secret</C> usado
                para gerar o token, uma aplicação de cada vez, sem janela de manutenção.
                Terminou de atualizar, use <strong>Encerrar janela</strong> e o antigo
                para na hora.
              </p>
              <Atencao>
                <strong>Se o seu segredo vazou, não espere os 7 dias:</strong> rotacione
                e encerre a janela imediatamente. Enquanto ela estiver aberta, os dois
                segredos emitem token para a sua conta. Se precisar cortar tudo de vez,
                revogue a credencial — os tokens dela param de valer na requisição
                seguinte.
              </Atencao>
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
    "documento": "12345678909",
    "email": "fulano@email.com",
    "telefone": "11999998888",
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
    "utm_term": "camiseta"
  },
  "urlCallback": "https://seusite.com/webhooks/pedido-123",
  "expiracaoSegundos": 3600
}`}</Codigo>

              <Tabela cabecalho={['Campo', 'Obrigatório', 'Regra']}>
                <Linha>
                  <Cel mono>valor</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    String com até 2 casas decimais e ponto como separador (
                    <C>&quot;150.00&quot;</C>). Não precisa ser igual à soma dos itens —
                    frete, desconto e acréscimo podem ficar fora. Precisa estar dentro do
                    ticket mínimo e máximo da sua conta, senão volta <C>400</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    O bloco inteiro é obrigatório — a liquidante recusa a cobrança sem
                    ele.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.nome</Cel>
                  <Cel>sim</Cel>
                  <Cel>Nome de quem vai pagar. Mínimo 2 caracteres.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.documento</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    <strong>CPF ou CNPJ do pagador</strong> — não existe campo para
                    escolher o tipo: identificamos pelo tamanho depois de tirar a máscara.
                    11 dígitos = CPF, 14 posições = CNPJ. Aceita com ou sem máscara e
                    aceita o <strong>CNPJ alfanumérico</strong> (12 posições com letras e
                    números + 2 dígitos verificadores). Qualquer outro tamanho volta{' '}
                    <C>400</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.email</Cel>
                  <Cel>sim</Cel>
                  <Cel>E-mail válido de quem vai pagar.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.telefone</Cel>
                  <Cel>não</Cel>
                  <Cel>Até 20 caracteres. Repassado à liquidante quando presente.</Cel>
                </Linha>
                <Linha>
                  <Cel mono>pagador.endereco</Cel>
                  <Cel>condicional</Cel>
                  <Cel>
                    Obrigatório se <strong>qualquer</strong> item for <C>tangivel: true</C>{' '}
                    (produto físico precisa de entrega). Exige <C>cep</C>,{' '}
                    <C>logradouro</C>, <C>numero</C>, <C>bairro</C>, <C>cidade</C> e{' '}
                    <C>uf</C>; <C>complemento</C> é opcional. Sem ele a cobrança é
                    recusada com <C>400</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>itens</Cel>
                  <Cel>sim</Cel>
                  <Cel>
                    De 1 a 100. Cada item exige <C>titulo</C> (até 255),{' '}
                    <C>quantidade</C> (inteiro positivo), <C>valorUnitario</C> (número) e{' '}
                    <C>tangivel</C> (booleano).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>referenciaExterna</Cel>
                  <Cel>não</Cel>
                  <Cel>
                    Seu identificador do pedido, até 255 caracteres, devolvido no
                    callback — <strong>recomendado sempre</strong>: é a sua proteção
                    contra duplicidade. Repetir a mesma referência com os{' '}
                    <strong>mesmos dados</strong> devolve a <strong>mesma cobrança</strong>{' '}
                    (nenhum PIX novo); com <strong>qualquer dado diferente</strong>,
                    gera uma <strong>cobrança nova</strong> — nunca <C>409</C>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>urlCallback</Cel>
                  <Cel>não</Cel>
                  <Cel>
                    URL válida, até 500 caracteres. Quando presente, esta cobrança notifica
                    também essa URL (veja{' '}
                    <a className="text-accent underline" href="#webhooks">Webhooks</a>).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>expiracaoSegundos</Cel>
                  <Cel>não</Cel>
                  <Cel>
                    Inteiro positivo, máximo <C>86400</C> (24 h). Padrão: 24 h.{' '}
                    <strong>
                      A liquidante trabalha em DIAS: qualquer valor é arredondado para
                      cima e o mínimo efetivo é 1 dia.
                    </strong>{' '}
                    Mandar <C>3600</C> não expira em 1 hora — expira em 24 h.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>rastreio</Cel>
                  <Cel>não</Cel>
                  <Cel>
                    Origem da venda (<C>utm_source</C>, <C>utm_campaign</C>,{' '}
                    <C>utm_medium</C>, <C>utm_content</C>, <C>utm_term</C>, <C>src</C>,{' '}
                    <C>sck</C> — todos até 255 caracteres). Não altera nada no PIX: é
                    repassado aos apps que você conectou em{' '}
                    <a className="text-accent underline" href="/desenvolvedores/integracoes">
                      Integrações
                    </a>{' '}
                    para atribuir a venda à campanha que a gerou. Envie o que o seu
                    checkout capturou da URL do anúncio — sem isso a venda chega no app
                    sem origem.
                  </Cel>
                </Linha>
              </Tabela>

              <Atencao>
                <strong>Sem nome, documento e e-mail do pagador não existe cobrança.</strong>{' '}
                A liquidante exige os três para gerar o PIX. Enviando incompleto, a
                resposta é <C>400</C> apontando o campo que falta — nenhum código PIX é
                gerado. Os mesmos três dados são exigidos pelos apps de rastreio que você
                pode conectar em{' '}
                <a className="text-accent underline" href="/desenvolvedores/integracoes">
                  Integrações
                </a>
                .
              </Atencao>

              <p>
                Resposta: <C>201 Created</C>.
              </p>

              <p>
                A resposta traz o <C>idTransacao</C> (uuid nosso, use para consultar e
                para casar o callback), o <C>pixCopiaCola</C>, o <C>txid</C>, a{' '}
                <C>urlCheckout</C>, o <C>valor</C>, a data de expiração em{' '}
                <C>expiraEm</C> e a situação <C>AGUARDANDO_PAGAMENTO</C>.
              </p>

              <p className="pt-2 font-medium">Exemplo (cURL)</p>
              <p>
                Troque <C>SEU_TOKEN</C> pelo <C>access_token</C> da seção{' '}
                <a className="text-accent underline" href="#autenticacao">
                  Autenticação
                </a>
                .
              </p>
              <Codigo rotulo="cash-in">{`curl -X POST ${API_URL}/v1/pix/cobrancas \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "valor": "150.00",
    "referenciaExterna": "pedido-123",
    "pagador": {
      "nome": "Fulano de Tal",
      "documento": "12345678909",
      "email": "fulano@email.com"
    },
    "itens": [
      { "titulo": "Curso", "quantidade": 1, "valorUnitario": 150.00, "tangivel": false }
    ]
  }'`}</Codigo>
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
                  <Cel>
                    A chave que vai receber o dinheiro, de 1 a 255 caracteres. Enviada
                    <strong> como você escreveu</strong> — não tiramos máscara nem
                    formatamos. Mande exatamente a chave registrada no DICT.
                  </Cel>
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
                    com ou sem máscara, e aceita o CNPJ alfanumérico.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>referenciaExterna</Cel>
                  <Cel>não</Cel>
                  <Cel>
                    Seu identificador do saque, devolvido no callback —{' '}
                    <strong>recomendado sempre</strong>. Repetir a mesma referência com
                    os <strong>mesmos dados</strong> devolve o <strong>mesmo saque</strong>{' '}
                    (nada é debitado de novo); com <strong>qualquer dado diferente</strong>,
                    volta <C>409</C>.
                  </Cel>
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
                A sua conta também precisa <strong>permitir saque pela API</strong>. Há
                contas configuradas só para saque pelo painel; nesse caso a chamada volta{' '}
                <C>400</C> dizendo que o saque via API não está habilitado. O valor
                também precisa estar dentro do ticket mínimo e máximo de saída da conta.
              </p>

              <Atencao>
                <strong>Saque nunca usa saldo negativo.</strong> Se o disponível não
                cobre valor + tarifa, a chamada é recusada com <C>400</C> e nada é
                debitado — mesmo que a conta esteja marcada para permitir saldo negativo
                (essa permissão existe para dívida de MED, não para saque).
              </Atencao>

              <Atencao>
                <strong>
                  A chave também pode precisar estar cadastrada e aprovada — inclusive
                  pela API.
                </strong>{' '}
                Por padrão a conta só saca para chave PIX que o administrador já aprovou.
                Nesse modo, mandar uma chave qualquer no <C>chavePix</C> volta{' '}
                <C>400</C>, mesmo com escopo e IP corretos. Se a sua conta está nesse
                modo, cadastre a chave em Configurações → Chaves PIX e espere a
                aprovação. Fale com o suporte se precisa sacar para chaves livres.
              </Atencao>

              <p>
                Pelo painel o fluxo é outro: você não digita a chave, escolhe uma da
                lista. O nome/documento do beneficiário vêm do cadastro — se a chave
                estiver sem esses dados, o saque é recusado até o cadastro ser completado.
              </p>
              <p>
                A resposta traz o <C>idTransacao</C> e a situação{' '}
                <C>PROCESSANDO</C> — nesse momento o valor{' '}
                <strong>já saiu</strong> do seu saldo.
              </p>
              <Atencao>
                <strong>
                  Saque recusado vira <C>FALHA</C> e o valor volta automaticamente.
                </strong>{' '}
                O saldo sai da carteira na criação. Se a liquidante recusar a ordem
                (documento que não bate com o dono da chave no DICT, chave inexistente,
                dado inválido), a operação encerra em <C>FALHA</C>, o{' '}
                <strong>valor e a tarifa são devolvidos ao seu saldo</strong> e você
                recebe o callback <C>pix.cashout.falhou</C>. É só corrigir o dado e
                tentar de novo.
              </Atencao>
              <p>
                Quando a resposta da liquidante é <strong>ambígua</strong> (timeout, erro
                de servidor), o comportamento é outro de propósito: sem saber se o
                dinheiro saiu, nem reenviamos nem estornamos — as duas coisas poderiam
                custar o valor duas vezes. A operação fica em <C>PROCESSANDO</C> até a
                conferência humana. Um saque parado nesse estado é caso de suporte.
              </p>

              <p className="pt-2 font-medium">Exemplo (cURL)</p>
              <p>
                Troque <C>SEU_TOKEN</C> pelo <C>access_token</C> da seção{' '}
                <a className="text-accent underline" href="#autenticacao">
                  Autenticação
                </a>
                .
              </p>
              <Codigo rotulo="cash-out">{`curl -X POST ${API_URL}/v1/pix/saques \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "valor": "80.00",
    "chavePix": "12345678909",
    "tipoChavePix": "CPF",
    "nomeBeneficiario": "Bruno de Tal",
    "documentoBeneficiario": "12345678909",
    "referenciaExterna": "saque-55"
  }'`}</Codigo>
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
                Exige o escopo <C>transacoes.ler</C> na credencial. O{' '}
                <C>{'{idTransacao}'}</C> é o <C>idTransacao</C> que devolvemos na criação
                (o mesmo que vai no callback) — não a sua <C>referenciaExterna</C>. Só
                enxerga transações da própria conta; id de outra conta responde{' '}
                <C>400</C>.
              </p>

              <p className="pt-2 font-medium">Exemplo (cURL)</p>
              <p>
                Troque <C>SEU_TOKEN</C> pelo <C>access_token</C> da seção{' '}
                <a className="text-accent underline" href="#autenticacao">
                  Autenticação
                </a>
                .
              </p>
              <Codigo rotulo="consulta">{`curl ${API_URL}/v1/pix/transacoes/SEU_ID_TRANSACAO \\
  -H "Authorization: Bearer SEU_TOKEN"`}</Codigo>

              <Codigo rotulo="resposta">{`{
  "idTransacao": "0b3f...",
  "direcao": "ENTRADA",
  "situacao": "CONCLUIDA",
  "valorBruto": "150.00",
  "valorTarifa": "3.75",
  "valorLiquidacao": "146.25",
  "valorReserva": "0.00",
  "pix": {
    "txid": "...", "pixCopiaCola": "000201...", "urlCheckout": "...",
    "expiraEm": "...", "chavePix": null, "tipoChavePix": null,
    "nomePagador": "Fulano de Tal", "nomeBeneficiario": null,
    "enderecoPagador": null
  },
  "itens": [
    { "titulo": "Camiseta", "quantidade": 2,
      "valorUnitario": "65.00", "valorTotal": "130.00", "tangivel": true }
  ],
  "criadoEm": "2026-08-07T12:00:00.000Z",
  "liquidadoEm": "2026-08-07T12:03:11.000Z"
}`}</Codigo>
              <p>
                Valores vêm como <strong>string decimal</strong>, não número — some
                sempre com biblioteca decimal, nunca com <C>float</C>. Note que a
                consulta <strong>não</strong> devolve <C>endToEnd</C> nem{' '}
                <C>referenciaExterna</C>: esses dois só chegam pelo callback.
              </p>

              <Atencao>
                <strong>O vocabulário aqui é diferente do callback.</strong> A consulta
                devolve <C>direcao</C> (<C>ENTRADA</C>/<C>SAIDA</C>) e a{' '}
                <C>situacao</C> interna crua — que inclui estados que o callback nunca
                envia, como <C>LIQUIDADA</C> e <C>PENDENTE</C>. O callback usa{' '}
                <C>operacao</C> (<C>cash_in</C>/<C>cash_out</C>) e <C>status</C>. Se você
                compara os dois, trate a diferença.
              </Atencao>

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
                    contestação (MED). Marca a <strong>chegada</strong> da contestação,
                    então pode vir preenchida antes de a venda mudar para o status{' '}
                    <C>MED</C> — e continua preenchida se a contestação for recusada e a
                    venda seguir <C>CONCLUIDA</C>. Use o <C>status</C> para decidir, não a
                    presença desta data.
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
                Entregamos por <C>POST</C> com <C>content-type: application/json</C>. Não
                há timeout curto do nosso lado, mas responda rápido: a conexão fica
                aberta esperando e a janela de retentativa é curta (abaixo).
              </p>
              <p>
                Responda <C>2xx</C> para confirmar. Cada evento tem no máximo{' '}
                <strong>5 tentativas</strong> (a primeira + 4 retentativas), com espera
                crescente de 2, 4, 8 e 16 segundos — ou seja,{' '}
                <strong>toda a janela cabe em cerca de 30 segundos</strong>. Depois disso
                o gateway não tenta mais sozinho.
              </p>
              <p>
                A retentativa é do <strong>evento</strong>, não de cada destino: se você
                tem dois destinos e um deles falha, a tentativa seguinte reenvia para os
                dois. Um endpoint saudável pode, portanto, receber o mesmo evento mais de
                uma vez enquanto o outro está fora do ar — mais uma razão para tratar o
                callback de forma idempotente, usando o <C>idTransacao</C>.
              </p>
              <Atencao>
                Trate seu endpoint como algo que precisa responder rápido e sempre. Se ele
                ficar fora do ar por mais de meio minuto, o callback daquela operação{' '}
                <strong>não chega</strong> — e a recuperação é manual, pelo botão{' '}
                <strong>Reenviar</strong> na tela de Transações ou Transferências.
                Confirme o desfecho por{' '}
                <a className="text-accent underline" href="#consultar">consulta</a> quando
                desconfiar de perda.
              </Atencao>
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
                  ├──▶ FALHA  (a liquidante recusou — valor + tarifa
                  │            voltam AUTOMATICAMENTE ao seu saldo)
                  │
                  └─ resposta ambígua (timeout)? fica em PROCESSANDO
                     para conferência humana — não reenviamos por conta própria`}</Codigo>
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
              descricao="Sucesso é 201 na criação e 200 na consulta. Erro vem em JSON, em um de dois formatos."
            >
              <p>
                <strong>Erro de validação de payload</strong> (
                <C>400</C> vindo do schema) devolve os campos que falharam, sem{' '}
                <C>message</C>:
              </p>
              <Codigo rotulo="400 — validação">{`{
  "formErrors": [],
  "fieldErrors": {
    "pagador": ["Required"],
    "valor": ["Invalid"]
  }
}`}</Codigo>

              <p>
                <strong>Os demais erros</strong> vêm no formato padrão, com{' '}
                <C>message</C> legível:
              </p>
              <Codigo rotulo="demais erros">{`{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Valor fora do ticket permitido"
}`}</Codigo>
              <p>
                Trate os dois: teste <C>fieldErrors</C> antes de ler <C>message</C>.
              </p>

              <Tabela cabecalho={['Código', 'Significado']}>
                <Linha>
                  <Cel mono>400</Cel>
                  <Cel>
                    Payload inválido (campo faltando, valor fora do permitido) —{' '}
                    <strong>e também</strong> regra de negócio recusada: valor fora do
                    ticket, adquirente indisponível para a conta, chave PIX não aprovada,
                    transação não encontrada na consulta.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>401</Cel>
                  <Cel>
                    Token de acesso ausente, inválido ou <strong>expirado</strong> —
                    gere um novo em <C>POST /v1/auth/token</C>. No próprio{' '}
                    <C>/v1/auth/token</C>: credenciais ausentes, inválidas,{' '}
                    <strong>revogadas</strong> ou <strong>expiradas</strong>.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>403</Cel>
                  <Cel>
                    Credencial sem o escopo necessário, IP fora da allowlist, ou conta
                    não ativa (encerrada, suspensa, bloqueada).
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>409</Cel>
                  <Cel>
                    Só no <strong>saque</strong>: <C>referenciaExterna</C> já usada num
                    saque com <strong>dados diferentes</strong>. Cobrança nunca responde{' '}
                    <C>409</C> pela referência — dados diferentes geram cobrança nova.
                    Veja Idempotência em{' '}
                    <a className="text-accent underline" href="#autenticacao">
                      Autenticação
                    </a>
                    .
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>429</Cel>
                  <Cel>
                    Limite de requisições excedido — reduza o ritmo e repita. Veja os
                    números em{' '}
                    <a className="text-accent underline" href="#autenticacao">
                      Autenticação
                    </a>
                    .
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>500</Cel>
                  <Cel>
                    Erro inesperado do nosso lado. Não repita em laço; se persistir, fale
                    com o suporte com o <C>idTransacao</C> ou o horário da chamada.
                  </Cel>
                </Linha>
                <Linha>
                  <Cel mono>503</Cel>
                  <Cel>
                    Nenhuma adquirente conseguiu gerar a cobrança — a transação fica em{' '}
                    <C>FALHA</C> e nenhum código PIX é emitido. Repetir a chamada é
                    seguro, <strong>inclusive com a mesma</strong>{' '}
                    <C>referenciaExterna</C>: a cobrança falhada não trava a referência,
                    e uma nova é gerada.
                  </Cel>
                </Linha>
              </Tabela>

              <Atencao>
                O corpo da requisição é limitado a <strong>256 KB</strong>. Acima disso a
                chamada é recusada antes de chegar na validação.
              </Atencao>
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
