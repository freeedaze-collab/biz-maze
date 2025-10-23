// @ts-nocheck
// src/pages/transfer/TransferScreen3.tsx
import React, { useMemo, useState } from 'react'
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi'
import { parseUnits, Address, zeroAddress } from 'viem'
import { polygon } from 'wagmi/chains'
import { triggerWalletSync } from '@/lib/walletSync'
import { WalletConnectButton } from '@/components/WalletConnectButton'

// 簡易 ERC20 ABI（transfer のみ）
const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const

type Props = {
  tokenAddress?: Address // 省略時は WETH on Polygon にする
  decimals?: number // 未指定時は 18
}

const DEFAULT_WETH_POLYGON = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as Address // WETH (Polygon)

export default function TransferScreen3({ tokenAddress, decimals = 18 }: Props) {
  const { isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending } = useWriteContract()

  const [to, setTo] = useState<string>('')
  const [amount, setAmount] = useState<string>('0')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const token = useMemo<Address>(() => (tokenAddress ?? DEFAULT_WETH_POLYGON), [tokenAddress])

  const validate = (): { to?: Address; amountWei?: bigint; error?: string } => {
    try {
      if (!to) return { error: 'Destination address required' }
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return { error: 'Invalid address format' }
      const toAddr = to as Address
      if (toAddr === zeroAddress) return { error: 'Zero address not allowed' }
      const n = Number(amount)
      if (!Number.isFinite(n) || n <= 0) return { error: 'Amount must be positive' }
      const amountWei = parseUnits(amount, decimals)
      return { to: toAddr, amountWei }
    } catch (e: any) {
      return { error: e?.message ?? 'Validation failed' }
    }
  }

  const onSend = async () => {
    setErr(null)
    setTxHash(null)
    if (!isConnected) {
      setErr('Please connect wallet first')
      return
    }
    // チェーンを Polygon に合わせる（必要なら他チェーンにも拡張可）
    await switchChainAsync({ chainId: polygon.id }).catch(() => {})

    const v = validate()
    if (v.error) {
      setErr(v.error)
      return
    }
    try {
      const hash = await writeContractAsync({
        abi: ERC20_ABI,
        address: token,
        functionName: 'transfer',
        args: [v.to!, v.amountWei!],
      })
      setTxHash(hash as string)
      // 送金後に同期
      await triggerWalletSync('polygon').catch(() => {})
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? 'Transaction failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transfer</h1>
        <WalletConnectButton />
      </div>

      <div className="space-y-2">
        <label className="block text-sm">To (address)</label>
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm">Amount</label>
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="e.g. 0.1"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {err && <div className="text-red-600">{err}</div>}

      <button
        className="px-4 py-2 rounded-md border"
        onClick={onSend}
        disabled={isPending}
        title="Send ERC-20 transfer on Polygon"
      >
        {isPending ? 'Sending…' : 'Send'}
      </button>

      {txHash && (
        <div className="text-sm">
          Tx:{" "}
          <a className="underline" target="_blank" rel="noreferrer" href={`https://polygonscan.com/tx/${txHash}`}>
            {txHash}
          </a>
        </div>
      )}
    </div>
  )
}
