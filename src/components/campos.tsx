'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Ajuda } from '@/components/ajuda';
import { Obrigatorio } from '@/components/obrigatorio';
import {
  mascararChavePix,
  metaCampoChavePix,
  type TipoChavePix,
} from '@/lib/chave-pix';

/**
 * Campos de formulário do painel — moeda, percentual, select e chaves.
 *
 * Existe para os números de dinheiro aparecerem como dinheiro (`R$ 50.000,00`)
 * em vez do decimal cru do banco (`50000`), e para o select ter a MESMA seta em
 * todo lugar: a nativa muda de desenho por navegador, cola na borda e não
 * acompanha o tema escuro.
 */

export const controleBase =
  'w-full rounded-lg border border-ink-800/15 bg-white text-[13px] text-ink-950 outline-none transition [color-scheme:light] placeholder:text-ink-800/35 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-ink-950/40 dark:text-white dark:[color-scheme:dark] dark:placeholder:text-white/30';

/** Altura única dos controles. 36px cabe mais coisa por linha que 40px. */
const ALTURA = 'h-9';

/**
 * Rótulo do campo. A dica curta vai ABAIXO do controle; a `ajuda` completa
 * fica no ícone ao lado do rótulo (tooltip), para não desalinear a grade.
 */
export function Rotulo({
  children,
  ajuda,
  obrigatorio,
}: {
  children: ReactNode;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium opacity-70">
      <span className="min-w-0 leading-snug">
        {children}
        {obrigatorio ? <Obrigatorio /> : null}
      </span>
      {ajuda ? <Ajuda texto={ajuda} /> : null}
    </span>
  );
}

function Dica({ children }: { children?: string }) {
  if (!children) return null;
  return <span className="mt-1 block text-[11px] leading-snug opacity-45">{children}</span>;
}

/**
 * Largura de um campo curto (valor, percentual, prazo). Sem teto, a grade
 * estica cada campo por centenas de pixels em monitor largo para mostrar
 * "1,00" — e a tela vira um deserto.
 */
export const LARGURA_CAMPO = 'w-full max-w-[11rem]';

/** Grade que mantém os campos compactos e encostados à esquerda. */
export const gradeCampos =
  'grid gap-x-3 gap-y-2.5 [grid-template-columns:repeat(auto-fill,minmax(9rem,11rem))]';

/**
 * Grade dos blocos de CONSULTA (rótulo em cima, valor embaixo). Não tem
 * controle, então as colunas podem esticar — o que não pode é sobrar meia tela
 * vazia com três colunas de 650px para mostrar "PF".
 */
export const gradeLeitura =
  'grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]';

/** Select com seta própria — a nativa não acompanha o tema. */
export function Selecao({
  label,
  dica,
  ajuda,
  obrigatorio,
  value,
  onChange,
  disabled,
  children,
  className = '',
}: {
  label?: string;
  dica?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${LARGURA_CAMPO} ${className}`}>
      {label && (
        <Rotulo ajuda={ajuda} obrigatorio={obrigatorio}>
          {label}
        </Rotulo>
      )}
      <span className="relative mt-1.5 block">
        <select
          className={`${controleBase} ${ALTURA} cursor-pointer appearance-none pl-3 pr-9`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-55"
          strokeWidth={2}
        />
      </span>
      <Dica>{dica}</Dica>
    </label>
  );
}

const formatarCentavos = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "1234.5" (banco) → 123450 (centavos). */
function paraCentavos(decimal: string): number {
  const n = Number(decimal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Campo de dinheiro. Digita-se só dígitos e eles entram pela direita, como em
 * caixa eletrônico — não dá para produzir "1.2.3" nem esquecer a vírgula. O
 * valor devolvido é sempre decimal com ponto, do jeito que a API espera.
 */
export function CampoMoeda({
  label,
  dica,
  ajuda,
  obrigatorio,
  valor,
  onChange,
  disabled,
  className = '',
}: {
  label: string;
  dica?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  valor: string;
  onChange: (decimal: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [centavos, setCentavos] = useState(() => paraCentavos(valor));

  // Sincroniza quando o valor chega da API depois do primeiro render, sem
  // atropelar o que o usuário está digitando.
  useEffect(() => {
    setCentavos((atual) =>
      paraCentavos(valor) !== atual && document.activeElement?.getAttribute('data-moeda') !== label
        ? paraCentavos(valor)
        : atual,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <label className={`block ${LARGURA_CAMPO} ${className}`}>
      <Rotulo ajuda={ajuda} obrigatorio={obrigatorio}>
        {label}
      </Rotulo>
      <span className="relative mt-1.5 block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50">
          R$
        </span>
        <input
          data-moeda={label}
          className={`${controleBase} ${ALTURA} pl-10 pr-3 text-right tabular-nums`}
          value={formatarCentavos(centavos)}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, '').slice(0, 13);
            const novo = digitos ? Number(digitos) : 0;
            setCentavos(novo);
            onChange((novo / 100).toFixed(2));
          }}
          inputMode="numeric"
          disabled={disabled}
        />
      </span>
      <Dica>{dica}</Dica>
    </label>
  );
}

/**
 * Percentual no mesmo padrão do dinheiro: só dígitos, vírgula entra sozinha.
 * Devolve decimal com ponto (`1.50`) para a API.
 */
export function CampoPercentual({
  label,
  dica,
  ajuda,
  valor,
  onChange,
  disabled,
  className = '',
}: {
  label: string;
  dica?: string;
  ajuda?: string;
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [centavos, setCentavos] = useState(() => paraCentavos(valor));

  useEffect(() => {
    setCentavos((atual) =>
      paraCentavos(valor) !== atual &&
      document.activeElement?.getAttribute('data-percentual') !== label
        ? paraCentavos(valor)
        : atual,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <label className={`block ${LARGURA_CAMPO} ${className}`}>
      <Rotulo ajuda={ajuda}>{label}</Rotulo>
      <span className="relative mt-1.5 block">
        <input
          data-percentual={label}
          className={`${controleBase} ${ALTURA} pl-3 pr-8 text-right tabular-nums`}
          value={formatarCentavos(centavos)}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, '').slice(0, 8);
            const novo = digitos ? Number(digitos) : 0;
            setCentavos(novo);
            onChange((novo / 100).toFixed(2));
          }}
          inputMode="numeric"
          disabled={disabled}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-50">
          %
        </span>
      </span>
      <Dica>{dica}</Dica>
    </label>
  );
}

/** Inteiro com sufixo (ex.: "2 dias"). */
export function CampoInteiro({
  label,
  dica,
  ajuda,
  sufixo,
  valor,
  onChange,
  disabled,
  className = '',
}: {
  label: string;
  dica?: string;
  ajuda?: string;
  sufixo?: string;
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${LARGURA_CAMPO} ${className}`}>
      <Rotulo ajuda={ajuda}>{label}</Rotulo>
      <span className="relative mt-1.5 block">
        <input
          className={`${controleBase} ${ALTURA} pl-3 text-right tabular-nums ${sufixo ? 'pr-12' : 'pr-3'}`}
          value={valor}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          disabled={disabled}
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50">
            {sufixo}
          </span>
        )}
      </span>
      <Dica>{dica}</Dica>
    </label>
  );
}

/**
 * Escolha única em linha. Substitui a lista de rádios empilhados: as opções
 * cabem numa faixa só e a selecionada é óbvia — no celular vira grade.
 */
export function Segmentado<T extends string>({
  label,
  dica,
  ajuda,
  valor,
  opcoes,
  onChange,
  disabled,
  className = '',
}: {
  label?: string;
  dica?: string;
  ajuda?: string;
  valor: T;
  opcoes: ReadonlyArray<{ v: T; label: string; dica?: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const atual = opcoes.find((o) => o.v === valor);
  return (
    <div className={`max-w-md ${className}`}>
      {(label || ajuda) && (
        <Rotulo ajuda={ajuda}>{label ?? 'Opção'}</Rotulo>
      )}
      {dica && <Dica>{dica}</Dica>}
      <div
        role="radiogroup"
        className={`mt-1.5 grid gap-1 rounded-lg border border-ink-800/15 p-1 dark:border-white/15 ${
          opcoes.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}
      >
        {opcoes.map((o) => {
          const ativo = o.v === valor;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={ativo}
              title={o.dica}
              disabled={disabled}
              onClick={() => onChange(o.v)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                ativo
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'opacity-60 hover:bg-ink-800/5 hover:opacity-100 dark:hover:bg-white/5'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {atual?.dica && (
        <p className="mt-1 text-[11px] opacity-50">{atual.dica}</p>
      )}
    </div>
  );
}

/** Liga/desliga em uma linha — ocupa menos que um checkbox com parágrafo. */
export function Interruptor({
  label,
  dica,
  ajuda,
  ligado,
  onChange,
  disabled,
  className = '',
}: {
  label: string;
  dica?: string;
  ajuda?: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex max-w-md items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${
        ligado
          ? 'border-accent/40 bg-accent/[0.06]'
          : 'border-ink-800/15 dark:border-white/15'
      } ${className}`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="min-w-0">{label}</span>
          {ajuda ? <Ajuda texto={ajuda} /> : null}
        </span>
        {dica && <span className="mt-0.5 block text-[11px] opacity-55">{dica}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!ligado)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ligado ? 'bg-accent' : 'bg-ink-800/20 dark:bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            ligado ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Chave PIX com máscara do tipo (CPF/CNPJ/telefone já existentes; e-mail e
 * UUID só restringem o que entra). Quem muda o tipo precisa LIMPAR o valor.
 */
export function CampoChavePix({
  tipo,
  valor,
  onChange,
  className = '',
  required,
}: {
  tipo: TipoChavePix | string;
  valor: string;
  onChange: (exibicao: string) => void;
  className?: string;
  required?: boolean;
}) {
  const meta = metaCampoChavePix(tipo);
  return (
    <input
      className={className}
      value={valor}
      onChange={(e) => onChange(mascararChavePix(tipo, e.target.value))}
      type={meta.inputType}
      inputMode={meta.inputMode}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={meta.placeholder}
      maxLength={meta.maxLength}
      required={required}
      aria-label="Chave PIX"
    />
  );
}
