// @ts-nocheck
import { ReactNode } from 'react';
import { WagmiProvider as BaseProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';

const qc = new QueryClient();

export function WagmiProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <BaseProvider config={wagmiConfig}>{children}</BaseProvider>
    </QueryClientProvider>
  );
}
