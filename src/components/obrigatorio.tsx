import type { ReactNode } from 'react';

/** Asterisco vermelho — indicador visual de campo obrigatório. */
export function Obrigatorio() {
  return (
    <span className="text-red-500" aria-hidden="true">
      {' *'}
    </span>
  );
}

type TextoRotuloProps = {
  children: ReactNode;
  /** Exibe `*` vermelho após o texto quando o campo é obrigatório. */
  obrigatorio?: boolean;
};

/**
 * Texto do rótulo de um campo. Use dentro de `<label>` antes do input/select.
 *
 * @example
 * <label className="block text-sm">
 *   <TextoRotulo obrigatorio>E-mail</TextoRotulo>
 *   <input required ... />
 * </label>
 */
export function TextoRotulo({ children, obrigatorio = false }: TextoRotuloProps) {
  return (
    <>
      {children}
      {obrigatorio ? <Obrigatorio /> : null}
    </>
  );
}
