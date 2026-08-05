# Gateway VPay — Web

Painel do gateway de pagamentos PIX da VPay em Next.js (App Router). Cobre o fluxo completo: cadastro e onboarding de documentos, área do cliente (dashboard, transações, adquirentes, chaves de API, webhooks) e área administrativa (aprovações, MED, tesouraria, contingência, relatórios, RBAC).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Estado de servidor | TanStack React Query 5 |
| Estilo | Tailwind CSS 3 (mobile-first, dark mode por classe via next-themes) |
| Gráficos | Recharts (dashboard) |
| Ícones | lucide-react |
| Tipografia | Fraunces (display) + DM Sans (Google Fonts) |

Formulários usam `useState` + `onSubmit` nativo e a tabela paginada é implementação própria (`src/components/tabela.tsx`) — não há dependência de biblioteca de forms/tabela em uso.

## Rodar local

Requer a API rodando (ver `Gateway-de-Pagamentos-VPay-api/README.md`).

```bash
npm install
npm run dev     # http://localhost:3000
```

### Variáveis de ambiente

Única variável, em `.env.local`:

| Variável | Para que serve |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base da API, **incluindo o prefixo `/api`** (default: `http://localhost:3001/api`) |

### Scripts

`dev` · `build` · `start` · `lint` (padrão Next).

## Estrutura

```
src/
  app/           # App Router — cada página monta o próprio <Shell>
  components/    # shell, tabela paginada, modal, marca, modais de domínio
  lib/           # api client, auth, permissões, brand, legal, máscaras
```

## Mapa de telas

### Públicas (sem token)

| Rota | O que faz |
|---|---|
| `/` | Redireciona para `/login` |
| `/login` | E-mail + senha; campo TOTP condicional (2FA); trata `situacao`/`proximoPasso` do onboarding |
| `/cadastro` | Cadastro PF/PJ com máscaras, bloco do responsável (PJ), endereço, e aceite dos 2 documentos legais (modal de leitura) |
| `/onboarding/documentos` | Upload de documentos **sem JWT** (reautentica e-mail+senha a cada request); lista enviados/faltantes com badges; PDF/JPG/PNG até 10 MB |
| `/senha/esqueci` · `/senha/redefinir` | Reset de senha (mensagem genérica anti-enumeração; link de 30 min) |

### Área do cliente (JWT)

| Rota | O que faz |
|---|---|
| `/dashboard` | Gráfico Geradas × Aprovadas, card de saldo com Depósito interno/Sacar, KPIs, transações recentes; bloco admin com visão global (só ADMINISTRADOR) |
| `/transacoes` | Movimentações da conta com filtros (situação, direção, busca) e paginação |
| `/adquirentes` | Vitrine de adquirentes liberadas; destaque da adquirente ativa de PIX in e troca |
| `/configuracoes` | Perfil, tema (PADRAO/CLARO/ESCURO) e 2FA (ativar com QR Code / desativar com senha) |
| `/desenvolvedores/chaves` | Credenciais de API (segredo exibido **uma única vez**) com allowlist de IP e revogação |
| `/desenvolvedores/webhooks` | Cadastro de webhooks: URL, header de validação e eventos (lista vinda de `GET /painel/webhooks/eventos`) |
| `/desenvolvedores/documentacao` | Referência da API pública (cobranças, saques, consulta, webhooks e eventos) |

### Área administrativa (JWT + permissão)

| Rota | O que faz |
|---|---|
| `/admin/aprovacoes` | Fila de análise de cadastros por abas; revisão de documentos, upload do contrato, aprovar/reprovar |
| `/admin/usuarios` · `/admin/usuarios/[idPublico]` | Gestão de cadastros e ficha completa: dados, documentos, carteira, situação, perfis, taxas e adquirente |
| `/admin/perfis` | CRUD de perfis com matriz recurso × ação (catálogo da API); ADMINISTRADOR travado (anti-lockout) |
| `/admin/chaves-pix` | Aprovação das chaves PIX dos clientes |
| `/admin/carteiras` | Saldos por cliente (4 baldes) com totais do filtro |
| `/admin/saldos` | Tesouraria: saldo da VPay por adquirente, gatilhos de saque automático e execuções |
| `/admin/contingencia` | Cadeia de contingência de adquirentes, resumo de falhas e response cru da liquidante |
| `/admin/adquirentes` | Cadastro de adquirentes, vitrine, taxas padrão e alternância em massa de clientes |
| `/admin/med` | Fila MED por abas; decisão Aceitar (devolve ao pagador) / Recusar (mantém o crédito) |
| `/admin/filas` | Descrição das filas BullMQ + link autenticado para o Bull Board da API |
| `/admin/auditoria` | Persistências (antes/depois em JSON) e acessos, com filtros |
| `/admin/relatorios/cash-in` · `/cash-out` · `/resultado` | Relatórios de transações por direção e apuração Lucro × Custo por cliente |

## Componentes compartilhados (`src/components`)

| Arquivo | Papel |
|---|---|
| `shell.tsx` | Layout autenticado: sidebar fixa à esquerda no desktop, drawer no mobile; menu em grupos filtrado por permissão; topbar com contador de sessão, indicador de 2FA e menu do usuário; **guarda de rota** com redirect + aviso "sem permissão" |
| `tabela.tsx` | Kit de listagem: `TabelaPaginada` (modos cliente e servidor), `BarraFiltros`, `FiltroTexto`/`FiltroSelect`, `Paginacao`, `SeletorPorPagina` |
| `modal.tsx` | `Modal` (bottom sheet no mobile, centrado no desktop) e `ModalAcoes` — rodapé padrão Cancelar (esquerda) / ação primária (direita) |
| `marca.tsx` | Logo VPay (mark ou wordmark, adaptada a fundo claro/escuro) |
| `conta-acoes.tsx` | Modais de Depositar (PIX copia-e-cola), Sacar (chave aprovada) e Criar credencial |
| `documentos-admin.tsx` | Visualizar/baixar/validar documentos KYC (compartilhado entre aprovações e ficha) |
| `relatorio-transacoes.tsx` | Relatório genérico parametrizado por direção (cash-in/cash-out) |
| `adquirente-modais.tsx` | Modais de adquirente, incl. o painel de substituição obrigatória quando uma adquirente sai de circulação |
| `gatilho-modal.tsx` | Cadastro/edição de gatilho de saque automático da tesouraria |

## `src/lib`

| Arquivo | Papel |
|---|---|
| `api.ts` | Cliente HTTP: `api<T>(path, {token, ...})` (fetch + `Authorization: Bearer`) e `apiUpload` (multipart do onboarding) |
| `auth.tsx` | `AuthProvider` / `useAuth`: token, usuário, `pode(codigo)`, `login`/`logout`/`refreshMe`/`patchTema` |
| `permissoes.ts` | Espelho do catálogo de permissões da API (`PERMISSOES.*`) + `permissaoDaRota(pathname)` |
| `brand.ts` | **Único lugar da identidade**: nome, site, e-mail, WhatsApp, logos e `docsVersao` — nunca hardcodar em página |
| `legal.ts` | Textos completos dos Termos de Uso e do Contrato de Intermediação (interpolam `BRAND`) |
| `documento.ts` | Máscaras/validação de CPF, CNPJ (incl. alfanumérico), CEP e telefone |
| `onboarding.ts` | Credenciais temporárias do onboarding em `sessionStorage` |

## Autenticação e autorização

- **Token:** JWT em `localStorage` (`vpay_token`), lido no mount do `AuthProvider` (`hidratando` evita flash de login em link direto). O `exp` é decodificado só para agendar o logout automático — quem valida é a API.
- **Login:** só persiste token quando `situacao === 'ATIVO'`. `requer2FA` revela o campo TOTP; `proximoPasso === 'ENVIAR_DOCUMENTOS'` salva as credenciais e leva para `/onboarding/documentos`; `EM_ANALISE` mostra aviso sem token.
- **Permissões:** `useAuth().pode(codigo)` esconde menus e botões; o `Shell` redireciona quem abre URL sem permissão para a primeira tela permitida, com banner de aviso. Isso é conveniência de UX — **quem barra de verdade é o 403 da API**.
- **Sem interceptors:** `api()` é um fetch simples; o token é passado explicitamente em cada chamada. Não há refresh token — a sessão expira com o JWT (contador regressivo na topbar).

## Padrões de UI (obrigatórios)

- **100% responsivo mobile-first** (375px+): Tailwind mobile-first (`sm:`/`lg:` para crescer), sidebar vira drawer, grids colapsam, tabelas em `overflow-x-auto`, sem overflow horizontal. Painéis decorativos somem no mobile.
- **Toda listagem é paginada e tem filtros acima** (`BarraFiltros` + `TabelaPaginada`). Backend expõe `page`/`limit` e filtros como query params.
- **Paginação default 10.** Telas de cliente: fixo em 10. Telas de admin: seletor "Por página" 10/25/50/100/500/1000.
- **Status só na edição:** na listagem, situação é badge somente-leitura — nunca botão de toggle na tabela.
- **Modais/formulários:** rodapé com Cancelar à esquerda e Salvar à direita (`ModalAcoes`).
- **Escopo de dados:** tela de cliente enxerga só a própria conta (o alvo é o usuário do JWT — não há id de conta na URL); visão cross-cliente é via telas/relatórios admin.
- **Nomenclatura:** "adquirentes" (não "provedores") na UI.
- **Branding:** sempre via `src/lib/brand.ts`.

## Tema

Dark mode completo via next-themes (`attribute="class"`, default `system`). A preferência do usuário (`PADRAO`/`CLARO`/`ESCURO`) é **persistida no backend** (`PATCH /auth/me`) e aplicada no login; trocável na topbar e em `/configuracoes`.

## Relação com a API

Todos os dados vêm da API NestJS (`Gateway-de-Pagamentos-VPay-api`), autenticados por JWT — o front não tem rotas de API próprias nem `middleware.ts`. O catálogo de permissões (`src/lib/permissoes.ts`) e a lista de eventos de webhook são espelhos do backend: ao alterar lá, atualizar aqui.
