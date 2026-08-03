'use client';

import { RelatorioTransacoes } from '@/components/relatorio-transacoes';

export default function CashInPage() {
  return (
    <RelatorioTransacoes
      direcao="ENTRADA"
      titulo="Relatório Cash-in"
      descricao="Todas as vendas que entraram (cobranças PIX), por cliente e produto."
    />
  );
}
