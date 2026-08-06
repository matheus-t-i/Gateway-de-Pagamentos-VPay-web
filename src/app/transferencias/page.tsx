'use client';

import { ExtratoPix } from '@/components/extrato-pix';

/** Transferências = PIX out. As entradas ficam em /transacoes. */
export default function TransferenciasPage() {
  return <ExtratoPix direcao="SAIDA" />;
}
