'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR do copia-e-cola PIX — gerado no cliente, sem round-trip na API. */
export function QrPix({ payload, rotulo }: { payload: string; rotulo?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!payload) {
      setSrc(null);
      return;
    }
    let cancelado = false;
    void QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    }).then((url) => {
      if (!cancelado) setSrc(url);
    });
    return () => {
      cancelado = true;
    };
  }, [payload]);

  if (!src) {
    return (
      <div
        className="mx-auto h-52 w-52 animate-pulse rounded-xl bg-ink-800/10 dark:bg-white/10"
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente
    <img
      src={src}
      alt={rotulo ?? 'QR Code PIX'}
      className="mx-auto h-52 w-52 rounded-xl bg-white p-2 ring-1 ring-ink-800/10 dark:ring-white/10"
    />
  );
}
