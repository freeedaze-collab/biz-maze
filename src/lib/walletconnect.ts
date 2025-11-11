import EthereumProvider from '@walletconnect/ethereum-provider';

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

export async function createWCProvider(): Promise<WCProvider> {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error('VITE_WC_PROJECT_ID is missing');

  const provider: WCProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    metadata: {
      name: 'BizMaze Wallet Link',
      description: 'Link your wallet',
      url: location.origin,
      icons: ['https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg'],
    },
  });

  return provider;
}