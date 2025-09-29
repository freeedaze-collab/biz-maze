import { useState } from 'react';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useWallet } from '@/hooks/useWallet';
import { DEFAULT_CHAIN, WETH_POLYGON } from '@/config/wagmi';

/**
 * TransferScreen3
 * - Polygon上のWETH(ERC-20, 18桁)送金を実行
 * - 送金成功後に履歴同期 → Transaction History / Accounting に反映
 *
 * 既存の画面遷移で to/amount を受け取っている場合は props を使用。
 * 何も来ない場合は本コンポーネント内のフォーム入力を使えます。
 */

type Asset = typeof WETH_POLYGON;

export default function TransferScreen3(props?: {
  to?: string;
  amount?: string;
  asset?: Asset;
}) {
  const defaultAsset = props?.asset ?? WETH_POLYGON; // Polygon WETH 既定
  const [to, setTo] = useState<string>(props?.to ?? '');
  const [amount, setAmount] = useState<string>(props?.amount ?? '');
  const asset = defaultAsset;

  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { syncWalletTransactions } = useWallet();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const onSend = async () => {
    setError(null);
    if (!address) return setError('Wallet not connected.');
    if (!to || Number(amount) <= 0) return setError('Invalid recipient or amount.');

    setBusy(true);
    try {
      // ネットワーク合わせ（Polygon）
      if (chainId !== asset.chainId) {
        await switchChainAsync({ chainId: asset.chainId });
      }

      // WETH(ERC-20) transfer(address,uint256)
      const hash = await writeContractAsync({
        address: asset.contract!,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
            outputs: [{ name: '', type: 'bool' }],
          },
        ] as const,
        functionName: 'transfer',
        args: [to as `0x${string}`, parseUnits(amount, asset.decimals)],
        chainId: DEFAULT_CHAIN.id,
      });

      setTxHash(hash);

      // 送金後の履歴同期（単発／必要ならポーリングへ拡張可能）
      await syncWalletTransactions({
        walletAddress: address,
        chainIds: [DEFAULT_CHAIN.id],
        cursor: null,
      });
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed.');
    } finally {
      setBusy(false);
    }
  };

  const explorerBase = 'https://polygonscan.com';

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Send WETH on Polygon</h1>

      {/* 入力フォーム（既存フローでprops受け取りの場合はそのまま表示だけでもOK） */}
      <div className="space-y-2">
        <label className="block text-sm">Recipient (0x...)</label>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="0xRecipient"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm">Amount (WETH)</label>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="0.05"
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
        />
      </div>

      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        onClick={onSend}
        disabled={busy}
      >
        {busy ? 'Sending…' : 'Send'}
      </button>

      {error && <div className="mt-3 text-red-600">{error}</div>}
      {txHash && (
        <div className="mt-3">
          Sent!{' '}
          <a className="underline" href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
            View on Polygonscan
          </a>
        </div>
      )}
    </div>
  );
}
