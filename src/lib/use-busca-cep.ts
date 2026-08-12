'use client';

import { useEffect, useRef, useState } from 'react';
import {
  consultarCep,
  type EnderecoCep,
  type SituacaoCep,
} from './cep';

/**
 * Dispara a consulta quando o CEP chega a 8 dígitos (digitação).
 * Não busca no mount — ficha já preenchida não pode ser sobrescrita.
 * Campos sempre editáveis: falha só muda o aviso.
 */
export function useBuscaCep(aplicar: (endereco: EnderecoCep) => void) {
  const [situacao, setSituacao] = useState<SituacaoCep>('idle');
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const buscar = (cep: string) => {
    const d = (cep ?? '').replace(/\D/g, '');
    abortRef.current?.abort();
    if (d.length !== 8) {
      setSituacao('idle');
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setSituacao('buscando');
    void consultarCep(d, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      if (r.ok) {
        aplicarRef.current(r.endereco);
        setSituacao('ok');
        return;
      }
      setSituacao(r.motivo);
    });
  };

  return { situacao, buscar };
}
