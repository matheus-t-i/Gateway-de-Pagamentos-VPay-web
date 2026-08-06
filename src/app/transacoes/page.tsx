'use client';

import { ExtratoPix } from '@/components/extrato-pix';

/** Transações = PIX in. As saídas ficam em /transferencias. */
export default function TransacoesPage() {
  return <ExtratoPix direcao="ENTRADA" />;
}
