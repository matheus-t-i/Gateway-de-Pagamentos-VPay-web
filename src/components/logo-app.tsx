'use client';

import { useState } from 'react';
import type { AppIntegracao } from '@/lib/integracoes';

const TAMANHOS = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-16 w-16 text-2xl',
} as const;

/**
 * Marca do app conectável.
 *
 * Usa o arquivo declarado em `CATALOGO_INTEGRACOES.logo` (`public/apps/…`) e,
 * enquanto ele não existir, cai num monograma na cor da marca. É de propósito:
 * a logo oficial de cada parceiro é um arquivo que vem de fora, então o card
 * não pode depender dela para existir — basta soltar o arquivo na pasta e ele
 * passa a aparecer, sem tocar em código.
 */
export function LogoApp({
  app,
  tamanho = 'md',
}: {
  app: Pick<AppIntegracao, 'nome' | 'logo' | 'corMarca'>;
  tamanho?: keyof typeof TAMANHOS;
}) {
  const [falhou, setFalhou] = useState(false);
  const classe = `${TAMANHOS[tamanho]} shrink-0 rounded-xl`;

  if (app.logo && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- asset de parceiro, sem otimização do Next
      <img
        src={app.logo}
        alt={app.nome}
        onError={() => setFalhou(true)}
        className={`${classe} object-contain`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${classe} flex items-center justify-center font-display font-bold text-white shadow-sm`}
      style={{
        background: `linear-gradient(135deg, ${app.corMarca}, ${app.corMarca}bb)`,
      }}
    >
      {app.nome.charAt(0).toUpperCase()}
    </div>
  );
}
