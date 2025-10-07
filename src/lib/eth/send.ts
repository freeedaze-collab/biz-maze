// src/lib/eth/send.ts
import { parseEther, type Address } from "viem";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

export function useEthSend() {
  const { address: from, chainId } = useAccount();
  const { data: hash, isPending, error, sendTransaction } = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash });

  const sendEth = (to: string, amountEth: string) => {
    // validate basic address format by viem
    const value = parseEther(amountEth || "0");
    sendTransaction({ to: to as Address, value });
  };

  return {
    from,
    chainId,
    sendEth,
    txHash: hash,
    isPending,
    error,
    receipt,
  };
}
