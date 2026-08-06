'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

/**
 * Cores de situação e de sentido do dinheiro, em UM lugar só.
 *
 * O mesmo status precisa ter a mesma cor no dashboard, no extrato do lojista e
 * nos relatórios do admin — quando cada tela pintava do seu jeito, verde num
 * lugar e cinza no outro significavam a mesma coisa e ninguém confiava na cor.
 */
const BADGE_SITUACAO: Record<string, string> = {
  CONCLUIDA:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  LIQUIDADA:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  AGUARDANDO_PAGAMENTO:
    'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  PROCESSANDO:
    'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  PENDENTE:
    'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  FALHA:
    'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20',
  CANCELADA:
    'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20',
  MED:
    'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20',
  // Entrega de webhook e envio a app conectado (`entregas_webhook`,
  // `envios_integracao`) — não é situação de transação, mas divide a tela com
  // elas e precisa das MESMAS cores para "deu certo" e "deu errado".
  SUCESSO:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  ATIVO:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  INATIVO:
    'bg-ink-800/5 text-ink-800/60 ring-ink-800/10 dark:bg-white/5 dark:text-white/60 dark:ring-white/10',
};

/**
 * Texto amigável de cada situação. O enum cru ("AGUARDANDO_PAGAMENTO") é
 * vocabulário interno; o lojista lê o que aconteceu com o dinheiro dele.
 */
const ROTULO_SITUACAO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PROCESSANDO: 'Processando',
  PENDENTE: 'Pendente',
  LIQUIDADA: 'Liquidada',
  CONCLUIDA: 'Concluída',
  FALHA: 'Falha',
  CANCELADA: 'Cancelada',
  // Mantém a sigla: "MED" é como o mercado chama a contestação do PIX, e é o
  // termo que o lojista procura no suporte e na documentação.
  MED: 'MED (devolvida)',
  SUCESSO: 'Sucesso',
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
};

export function rotuloSituacao(situacao: string) {
  return ROTULO_SITUACAO[situacao] ?? situacao.replaceAll('_', ' ');
}

export function BadgeSituacao({ situacao }: { situacao: string }) {
  return (
    <span
      title={situacao}
      className={`inline-flex whitespace-nowrap items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        BADGE_SITUACAO[situacao] ??
        'bg-ink-800/5 ring-ink-800/10 dark:bg-white/5 dark:ring-white/10'
      }`}
    >
      {rotuloSituacao(situacao)}
    </span>
  );
}

/**
 * Há quanto tempo uma solicitação está na fila esperando decisão humana
 * (cadastro em aprovação, chave PIX pendente). A cor escala com o atraso: o
 * analista precisa enxergar o que está encalhando sem abrir registro por
 * registro. O texto absoluto fica no `title` para quem precisa da data exata.
 */
export function IdadeSolicitacao({ desde }: { desde: string }) {
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000);
  const texto = dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  const cor =
    dias >= 7
      ? 'text-red-600 dark:text-red-400'
      : dias >= 3
        ? 'text-amber-600 dark:text-amber-400'
        : 'opacity-60';
  return (
    <span
      className={`text-xs font-medium ${cor}`}
      title={new Date(desde).toLocaleString('pt-BR')}
    >
      {texto}
    </span>
  );
}

/**
 * Tipo de operação: entrada (dinheiro chegando) em verde, saída (dinheiro
 * indo embora) em vermelho. A seta acompanha a cor porque cor sozinha não
 * serve para quem não distingue verde de vermelho.
 */
export function BadgeTipoOperacao({ direcao }: { direcao: string }) {
  const entrada = direcao === 'ENTRADA';
  const Icone = entrada ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        entrada
          ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20'
          : 'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20'
      }`}
    >
      <Icone className="h-3 w-3" strokeWidth={2.5} />
      {entrada ? 'Entrada' : 'Saída'}
    </span>
  );
}
