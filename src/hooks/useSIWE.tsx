import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from './use-toast';

/**
 * 変更点（要約）
 * - これまでの { message, signature, address } を直接投げる方式を廃止
 * - Edge Function の仕様（action: 'nonce' → 'verify'）に合わせてフローを統一
 * - 署名は personal_sign（EIP-191）、サーバは hashMessage(nonce) + recoverAddress
 * - 正常時 wallets へ upsert（Edge Function側実装済）
 */
export function useSIWE() {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  // ユーザーのウォレット所有を検証し、OKなら wallets に紐づく（Edge Function 側の upsert が実行される）
  const verifyWalletOwnership = async (address: string): Promise<boolean> => {
    setIsVerifying(true);
    try {
      if (!address) {
        toast({
          title: "❌ Address Missing",
          description: "Connect your wallet first.",
          variant: "destructive",
        });
        return false;
      }

      // 1) ノンス取得（サーバに保存される）
      const { data: nonceResp, error: nErr } = await supabase.functions.invoke('verify-2', {
        body: { action: 'nonce' },
      });
      if (nErr) {
        console.error('nonce error:', nErr);
        toast({
          title: "❌ Nonce Error",
          description: "Failed to get verification nonce.",
          variant: "destructive",
        });
        return false;
      }
      const nonce = String(nonceResp?.nonce ?? '');
      if (!nonce) {
        toast({
          title: "❌ Nonce Missing",
          description: "Verification nonce was not issued.",
          variant: "destructive",
        });
        return false;
      }

      // 2) personal_sign（EIP-191）で nonce に署名（整形しない）
      // 既存コードは window.ethereum を直接呼んでいるスタイルなので踏襲
      if (typeof (window as any).ethereum === 'undefined') {
        toast({
          title: "❌ Wallet Not Found",
          description: "Please install/unlock your wallet extension.",
          variant: "destructive",
        });
        return false;
      }
      // MetaMask などは params: [message, from]
      const signature: string = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [nonce, address],
      });

      if (!signature) {
        toast({
          title: "❌ Signature Failed",
          description: "Wallet signature was not obtained.",
          variant: "destructive",
        });
        return false;
      }

      // 3) 検証実行（recover → wallets upsert → nonce クリア）
      const { data, error } = await supabase.functions.invoke('verify-2', {
        body: { action: 'verify', address, signature, nonce },
      });
      if (error) {
        console.error('verify error:', error);
        toast({
          title: "❌ Verification Error",
          description: "Server verification failed.",
          variant: "destructive",
        });
        return false;
      }

      if (data?.ok) {
        toast({
          title: "✅ Wallet Verified",
          description: "Your wallet has been verified and linked.",
        });
        return true;
      }

      toast({
        title: "❌ Verification Failed",
        description: "Signature did not match the wallet address.",
        variant: "destructive",
      });
      return false;
    } catch (error) {
      console.error('Wallet verification exception:', error);
      toast({
        title: "❌ Verification Exception",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    isVerifying,
    verifyWalletOwnership,
  };
}
