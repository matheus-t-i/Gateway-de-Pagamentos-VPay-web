'use client';

import { RelatorioTransacoes } from '@/components/relatorio-transacoes';

export default function CashOutPage() {
  return (
    <RelatorioTransacoes
      direcao="SAIDA"
      titulo="Relatório Cash-out"
      descricao="Todos os saques/pagamentos que saíram, por beneficiário e adquirente."
    />
  );
}
