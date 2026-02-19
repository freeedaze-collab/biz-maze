// src/hooks/useSIWE.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Edge Function と共有するメッセージフォーマット（必ず同一にする）
// ============================================================
function buildSignMessage(address: string, nonce: string): string {
  return `Welcome to CryptoFinance!\n\nPlease sign this message to verify you own this wallet.\n\nWallet: ${address}\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas.`;
}

export function useSIWE() {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  /**
   * ウォレット所有権を署名で証明し、wallet_connections に登録する
   * @param address - 検証したいウォレットアドレス (0x...)
   * @param walletType - 'metamask' など（将来の拡張用。現在はEVM固定）
   * @returns 成功したら true
   */
  const verifyWalletOwnership = async (address: string, walletType = 'metamask'): Promise<boolean> => {
    setIsVerifying(true);

    try {
      // ── Step 0: 前提チェック ──────────────────────────────
      if (!address) {
        toast({ title: '❌ アドレスが必要です', variant: 'destructive' });
        return false;
      }

      // MetaMask（window.ethereum）の存在確認
      if (typeof (window as any).ethereum === 'undefined') {
        toast({
          title: '❌ ウォレット拡張が見つかりません',
          description: 'MetaMask をインストールして再試行してください。',
          variant: 'destructive',
        });
        return false;
      }

      // Supabase セッション確認（JWT取得のため）
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast({
          title: '❌ ログインが必要です',
          description: 'ウォレットを連携する前にログインしてください。',
          variant: 'destructive',
        });
        return false;
      }

      // ── Step 1: nonce を取得 ──────────────────────────────
      // GETリクエストで nonce を発行してもらう
      const { data: nonceResp, error: nonceErr } = await supabase.functions.invoke('verify-2', {
        method: 'GET',
      });

      if (nonceErr) throw new Error(`Nonce取得に失敗: ${nonceErr.message}`);
      const nonce: string = nonceResp?.nonce;
      if (!nonce) throw new Error('サーバーから nonce が返されませんでした。');

      // ── Step 2: メッセージを構築して署名を要求 ────────────
      // Edge Function と完全に同一のメッセージを生成する
      const message = buildSignMessage(address, nonce);

      let signature: string;
      try {
        // MetaMask: personal_sign(message, address) の順
        signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } catch (signError: any) {
        // ユーザーがキャンセルした場合は静かに終了
        if (signError.code === 4001) {
          toast({ title: 'キャンセルされました', description: '署名がキャンセルされました。' });
          return false;
        }
        throw new Error(`署名に失敗しました: ${signError.message}`);
      }

      if (!signature) throw new Error('署名が取得できませんでした。');

      // ── Step 3: 署名を Edge Function に送って検証・登録 ───
      const { data, error: verifyErr } = await supabase.functions.invoke('verify-2', {
        body: { address, signature, nonce },
      });

      if (verifyErr) throw new Error(`検証リクエストに失敗: ${verifyErr.message}`);

      if (!data?.ok) {
        throw new Error(data?.error ?? '署名の検証に失敗しました。');
      }

      toast({
        title: '✅ ウォレットが連携されました',
        description: `${address.substring(0, 6)}...${address.substring(address.length - 4)} の所有権を確認しました。`,
      });
      return true;

    } catch (error: any) {
      console.error('[useSIWE] verifyWalletOwnership error:', error);
      toast({
        title: '❌ 連携に失敗しました',
        description: error.message ?? '不明なエラーが発生しました。',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  return { isVerifying, verifyWalletOwnership };
}
