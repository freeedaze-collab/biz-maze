// src/lib/walletconnect.ts
// WalletConnect v2 Provider（拡張機能なしでモバイル署名を実現）
import { EthereumProvider } from "@walletconnect/ethereum-provider";

export type WCProvider = Awaited<ReturnType<typeof EthereumProvider.init>>;

export async function initWalletConnect(): Promise<WCProvider> {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  // EIP-155 チェーンは必要分を列挙（Polygon/Ethereum/Arbitrum/Base）
  const chains = [1, 137, 42161, 8453];

  const provider = await EthereumProvider.init({
    projectId,
    showQrModal: true,    // PC なら QR、スマホなら専用アプリが開く
    chains,
    methods: ["personal_sign", "eth_requestAccounts"],
    optionalMethods: [],
    events: ["chainChanged", "accountsChanged", "session_delete"],
    rpcMap: {},           // 既定でOK（公共RPCを使う）
  });

  return provider;
}
