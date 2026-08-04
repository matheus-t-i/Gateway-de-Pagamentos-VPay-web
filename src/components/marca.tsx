import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

type MarcaProps = {
  /** Só o ícone V (mark). Sem compact → wordmark completo. */
  compact?: boolean;
  /**
   * Qual wordmark usar:
   * - `auto` — tema claro → letra preta; tema escuro → letra branca
   * - `claro` — força letra preta (painel / fundo claro)
   * - `escuro` — força letra branca (painel / fundo escuro fixo)
   */
  fundo?: 'auto' | 'claro' | 'escuro';
  className?: string;
  /** Link opcional; `null` renderiza sem âncora. Default `/`. */
  href?: string | null;
  prioridade?: boolean;
};

function Wordmark({
  fundo,
  prioridade,
  className,
}: {
  fundo: 'auto' | 'claro' | 'escuro';
  prioridade?: boolean;
  className?: string;
}) {
  const base =
    className ?? 'h-8 w-auto max-w-[9.5rem] object-contain object-left sm:h-9';

  if (fundo === 'claro') {
    return (
      <Image
        src={BRAND.logos.dark}
        alt={BRAND.nome}
        width={220}
        height={56}
        priority={prioridade}
        className={base}
      />
    );
  }

  if (fundo === 'escuro') {
    return (
      <Image
        src={BRAND.logos.light}
        alt={BRAND.nome}
        width={220}
        height={56}
        priority={prioridade}
        className={base}
      />
    );
  }

  return (
    <>
      <Image
        src={BRAND.logos.dark}
        alt={BRAND.nome}
        width={220}
        height={56}
        priority={prioridade}
        className={`${base} dark:hidden`}
      />
      <Image
        src={BRAND.logos.light}
        alt={BRAND.nome}
        width={220}
        height={56}
        priority={prioridade}
        className={`hidden ${base} dark:block`}
      />
    </>
  );
}

/**
 * Marca visual VPay. Alterna wordmark preto/branco via classe `.dark`
 * (next-themes / preferência PADRAO|CLARO|ESCURO).
 */
export function Marca({
  compact = false,
  fundo = 'auto',
  className = '',
  href = '/',
  prioridade,
}: MarcaProps) {
  const conteudo = compact ? (
    <Image
      src={BRAND.logos.mark}
      alt={BRAND.nome}
      width={40}
      height={40}
      priority={prioridade}
      className="h-9 w-9 object-contain sm:h-10 sm:w-10"
    />
  ) : (
    <Wordmark fundo={fundo} prioridade={prioridade} />
  );

  const wrapperClass = `inline-flex items-center ${className}`.trim();

  if (href === null) {
    return <span className={wrapperClass}>{conteudo}</span>;
  }

  return (
    <Link href={href} className={`group ${wrapperClass}`} aria-label={BRAND.nome}>
      {conteudo}
    </Link>
  );
}
