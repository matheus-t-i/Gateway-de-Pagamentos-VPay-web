'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth';
import { StepUpTotpHost } from '@/components/step-up-totp-host';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        <AuthProvider>
          {children}
          <StepUpTotpHost />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
