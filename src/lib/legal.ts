import { BRAND } from './brand';

export type SecaoLegal = { titulo: string; corpo: string[] };
export type DocumentoLegal = {
  codigo: 'TERMOS_USO_PRIVACIDADE' | 'CONTRATO_INTERMEDIACAO';
  titulo: string;
  versao: string;
  intro: string[];
  secoes: SecaoLegal[];
};

const N = BRAND.nome;

export const TERMOS_USO: DocumentoLegal = {
  codigo: 'TERMOS_USO_PRIVACIDADE',
  titulo: `Termos de Uso e Política de Privacidade — ${N}`,
  versao: BRAND.docsVersao,
  intro: [
    'Data do aceite: será registrada no momento do aceite eletrônico.',
    `Bem-vindo à ${N}. Ao acessar, criar uma conta ou utilizar qualquer funcionalidade da plataforma ${N}, o usuário declara ter lido, compreendido e aceitado integralmente os presentes Termos de Uso e Política de Privacidade.`,
    `A ${N} atua como plataforma tecnológica de intermediação de pagamentos, disponibilizando soluções financeiras, APIs, links de pagamento, ferramentas operacionais e recursos relacionados à gestão de recebimentos e pagamentos digitais.`,
  ],
  secoes: [
    {
      titulo: '1. Aceite e utilização da plataforma',
      corpo: [
        `O uso da plataforma ${N} depende do aceite integral destes termos. Ao utilizar a plataforma, o usuário declara:`,
        '• possuir capacidade legal para contratação;',
        '• fornecer informações verdadeiras e atualizadas;',
        '• utilizar a plataforma de forma legítima e compatível com a legislação aplicável;',
        '• responsabilizar-se integralmente pelas atividades realizadas em sua conta.',
      ],
    },
    {
      titulo: '2. Cadastro e responsabilidade da conta',
      corpo: [
        'O usuário é responsável:',
        '• pela veracidade das informações fornecidas;',
        '• pela segurança de suas credenciais;',
        '• por todas as movimentações realizadas em sua conta;',
        '• por manter seus dados atualizados.',
        `A ${N} poderá solicitar documentos, informações adicionais ou procedimentos de validação sempre que considerar necessário para fins operacionais, cadastrais, regulatórios ou de segurança.`,
      ],
    },
    {
      titulo: '3. Utilização da plataforma',
      corpo: [
        `A ${N} disponibiliza recursos tecnológicos relacionados à:`,
        '• intermediação de pagamentos;',
        '• processamento de transações;',
        '• APIs;',
        '• links de pagamento;',
        '• gerenciamento operacional;',
        '• notificações;',
        '• integrações;',
        '• ferramentas de acompanhamento financeiro.',
        `A utilização da plataforma deverá respeitar a legislação vigente, bem como as políticas internas da ${N} e de seus parceiros operacionais.`,
      ],
    },
    {
      titulo: '4. Monitoramento e segurança operacional',
      corpo: [
        `Com o objetivo de garantir segurança operacional, estabilidade da plataforma e prevenção de uso indevido, a ${N} poderá realizar procedimentos internos de monitoramento, análise e validação de operações.`,
        'A plataforma poderá:',
        '• solicitar informações complementares;',
        '• revisar movimentações;',
        '• limitar funcionalidades;',
        '• realizar validações adicionais;',
        '• suspender temporariamente recursos específicos;',
        '• interromper operações consideradas incompatíveis com suas políticas internas ou requisitos operacionais.',
      ],
    },
    {
      titulo: '5. Comunicações',
      corpo: [
        `O usuário autoriza a ${N} a realizar comunicações relacionadas à plataforma, conta, operações, segurança, suporte, atualizações e funcionalidades por meio de:`,
        '• e-mail;',
        '• WhatsApp;',
        '• notificações push;',
        '• SMS;',
        '• notificações internas da plataforma.',
      ],
    },
    {
      titulo: '6. Privacidade e tratamento de dados',
      corpo: [
        `A ${N} poderá coletar e tratar dados necessários à operação da plataforma, incluindo: dados cadastrais; informações financeiras; endereço IP; dados de dispositivo; geolocalização aproximada; navegador; cookies; logs de acesso; sessões; informações de integração; registros de operações; payloads técnicos; dados relacionados à segurança e prevenção à fraude.`,
        'Os dados poderão ser utilizados para: funcionamento da plataforma; segurança operacional; prevenção à fraude; validação cadastral; melhoria dos serviços; cumprimento de obrigações legais; suporte; auditoria; monitoramento técnico; comunicações operacionais.',
      ],
    },
    {
      titulo: '7. Compartilhamento de dados',
      corpo: [
        `A ${N} poderá compartilhar informações com: adquirentes; instituições financeiras; parceiros operacionais; provedores de tecnologia; ferramentas antifraude; prestadores de serviço; autoridades competentes, quando necessário.`,
        'O compartilhamento ocorrerá sempre observando critérios operacionais, legais e de segurança.',
      ],
    },
    {
      titulo: '8. Limitação de responsabilidade',
      corpo: [
        `A ${N} atua como intermediadora tecnológica de pagamentos e não participa diretamente da relação comercial entre vendedores e compradores.`,
        'A plataforma não se responsabiliza: pelos produtos ou serviços comercializados pelos usuários; por promessas comerciais realizadas por terceiros; pela entrega de produtos ou serviços; por informações fornecidas pelos usuários; por falhas causadas por terceiros; por indisponibilidades externas; por interrupções de instituições financeiras; por falhas de adquirentes; por instabilidades de internet; por integrações externas.',
        `Embora a ${N} adote medidas razoáveis de segurança e monitoramento, não há garantia absoluta de disponibilidade contínua ou ausência total de falhas técnicas.`,
      ],
    },
    {
      titulo: '9. Suspensão e encerramento de conta',
      corpo: [
        `A ${N} poderá limitar, suspender ou encerrar contas e funcionalidades sempre que identificar: inconsistências cadastrais; utilização incompatível com suas políticas; riscos operacionais; indícios de utilização indevida; descumprimento destes termos; necessidade de revisão operacional.`,
      ],
    },
    {
      titulo: '10. Propriedade intelectual',
      corpo: [
        `Todos os elementos da plataforma ${N}, incluindo marca, logotipos, layout, APIs, sistemas, interfaces, softwares, conteúdos, elementos gráficos e identidade visual, são protegidos pela legislação aplicável e não poderão ser reproduzidos sem autorização prévia.`,
      ],
    },
    {
      titulo: '11. Aceite eletrônico',
      corpo: [
        'O aceite eletrônico realizado pelo usuário, inclusive por meio de checkbox, clique, confirmação digital ou utilização da plataforma, será considerado válido para todos os fins legais.',
      ],
    },
    {
      titulo: '12. Alterações',
      corpo: [
        `A ${N} poderá atualizar estes Termos de Uso e Política de Privacidade a qualquer momento, sendo responsabilidade do usuário consultar periodicamente a versão vigente.`,
      ],
    },
    {
      titulo: '13. Contato',
      corpo: [
        'Em caso de dúvidas, solicitações ou suporte:',
        `Site: ${BRAND.site}`,
        `E-mail: ${BRAND.email}`,
        `WhatsApp: ${BRAND.whatsapp}`,
      ],
    },
  ],
};

export const CONTRATO_INTERMEDIACAO: DocumentoLegal = {
  codigo: 'CONTRATO_INTERMEDIACAO',
  titulo: `Contrato de Intermediação de Pagamentos — ${N}`,
  versao: BRAND.docsVersao,
  intro: [
    'Data do aceite: será registrada no momento do aceite eletrônico.',
    `O presente Contrato de Intermediação de Pagamentos regula a utilização da plataforma ${N} pelo usuário contratante. Ao utilizar os serviços da plataforma, o usuário declara estar ciente e concordar integralmente com as disposições abaixo.`,
  ],
  secoes: [
    {
      titulo: '1. Objeto',
      corpo: [
        `A ${N} disponibiliza infraestrutura tecnológica destinada à intermediação e processamento de pagamentos digitais, incluindo APIs, links de pagamento, ferramentas operacionais e soluções relacionadas à gestão financeira e transacional.`,
      ],
    },
    {
      titulo: '2. Natureza da atividade',
      corpo: [
        `A ${N} atua exclusivamente como intermediadora tecnológica de pagamentos. A plataforma:`,
        '• não comercializa produtos;',
        '• não presta os serviços ofertados pelos usuários;',
        '• não participa da negociação comercial;',
        '• não garante promessas realizadas por terceiros;',
        '• não integra a relação jurídica entre comprador e vendedor.',
        'Toda responsabilidade relacionada à oferta, divulgação, comercialização, entrega, suporte, origem das operações, conteúdo e legalidade dos produtos ou serviços é exclusiva do usuário responsável pela operação.',
      ],
    },
    {
      titulo: '3. Responsabilidade do usuário',
      corpo: [
        'O usuário declara que:',
        '• possui autorização legal para exercer suas atividades;',
        '• utilizará a plataforma de forma legítima;',
        '• é integralmente responsável pelas operações realizadas;',
        '• responderá por suas atividades perante terceiros e autoridades competentes.',
        `O usuário compromete-se a não utilizar a plataforma para atividades incompatíveis com a legislação aplicável ou com as políticas operacionais da ${N}.`,
      ],
    },
    {
      titulo: '4. Validação e segurança operacional',
      corpo: [
        `A ${N} poderá adotar procedimentos internos de validação, monitoramento e segurança operacional com o objetivo de preservar a integridade da plataforma, reduzir riscos operacionais, prevenir utilização indevida e atender requisitos técnicos e operacionais.`,
        'Sempre que necessário, poderão ser solicitados documentos, informações adicionais, comprovações cadastrais e validações complementares.',
      ],
    },
    {
      titulo: '5. Limitação operacional',
      corpo: [
        `A ${N} poderá revisar movimentações, limitar funcionalidades, suspender temporariamente operações, interromper transações, restringir acessos e encerrar contas sempre que considerar necessário para fins operacionais, técnicos, cadastrais, de segurança ou conformidade.`,
      ],
    },
    {
      titulo: '6. Indisponibilidade e serviços de terceiros',
      corpo: [
        `A ${N} depende de estruturas e integrações de terceiros, incluindo instituições financeiras, adquirentes, provedores tecnológicos, APIs externas e infraestrutura de internet.`,
        `Dessa forma, poderão ocorrer indisponibilidades, atrasos, falhas técnicas, oscilações e interrupções temporárias. A ${N} não garante disponibilidade ininterrupta dos serviços.`,
      ],
    },
    {
      titulo: '7. Comunicação e cooperação',
      corpo: [
        `A ${N} poderá compartilhar informações operacionais com parceiros, adquirentes, instituições financeiras e autoridades competentes sempre que necessário para funcionamento da plataforma, segurança operacional, prevenção à fraude, cumprimento de obrigações legais e atendimento regulatório.`,
      ],
    },
    {
      titulo: '8. Responsabilidade financeira',
      corpo: [
        `A ${N} não se responsabiliza pela origem individual das operações realizadas pelos usuários, pelos produtos ou serviços comercializados, por disputas comerciais entre compradores e vendedores, por promessas comerciais de terceiros, por obrigações tributárias dos usuários ou por danos decorrentes da atuação dos usuários perante terceiros.`,
      ],
    },
    {
      titulo: '9. Aceite digital',
      corpo: [
        'O aceite eletrônico deste contrato, inclusive por meio de checkbox, clique, confirmação digital ou utilização da plataforma, possui validade jurídica e representa concordância integral com seus termos.',
      ],
    },
    {
      titulo: '10. Disposições finais',
      corpo: [
        `A utilização da plataforma ${N} pressupõe boa-fé, responsabilidade operacional e observância às políticas internas da plataforma.`,
        `A ${N} poderá atualizar este contrato sempre que necessário para adequação operacional, tecnológica ou legal.`,
      ],
    },
    {
      titulo: '11. Contato',
      corpo: [
        `Site: ${BRAND.site}`,
        `E-mail: ${BRAND.email}`,
        `WhatsApp: ${BRAND.whatsapp}`,
      ],
    },
  ],
};
