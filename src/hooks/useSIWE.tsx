
import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from './use-toast';

export function useSIWE() {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  // `walletType` を引数に追加
  const verifyWalletOwnership = async (address: string, walletType: string): Promise<boolean> => {
    setIsVerifying(true);
    try {
      if (!address || !walletType) {
        toast({
          title: "❌ Missing Information",
          description: "Address and wallet type are required.",
          variant: "destructive",
        });
        return false;
      }

      // 1) ノンス取得 - GETリクエスト（URLをクリーンアップ）
      const { data: nonceResp, error: nErr } = await supabase.functions.invoke('verify-2', {
        method: 'GET',
      });
      if (nErr) throw new Error(nErr.message);
      const nonce = nonceResp?.nonce;
      if (!nonce) throw new Error("Nonce was not issued.");

      // 2) personal_sign で署名
      if (typeof (window as any).ethereum === 'undefined') throw new Error("Wallet extension not found.");
      const signature: string = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [nonce, address],
      });
      if (!signature) throw new Error("Signature was not obtained.");

      // 3) 検証実行 - POSTリクエスト（bodyを修正）
      const { data, error } = await supabase.functions.invoke('verify-2', {
        body: { address, signature, nonce, wallet_type: walletType }, // `wallet_type` を追加
      });

      if (error) throw new Error(error.message);

      if (data?.ok) {
        toast({
          title: "✅ Wallet Verified",
          description: "Your wallet has been verified and linked.",
        });
        return true;
      } else {
        throw new Error(data?.error || "Signature did not match.");
      }

    } catch (error: any) {
      console.error('Wallet verification error:', error);
      toast({
        title: "❌ Verification Failed",
        description: error.message,
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
