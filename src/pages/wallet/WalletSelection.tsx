// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function WalletSelection() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending: isConnPending, error: connError } = useConnect({ connector: injected() });
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });

  const [saving, setSaving] = useState(false);
  const short = useMemo(() => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-"), [address]);

  useEffect(() => {
    // アカウント接続/切断の状態をコンソールで可視化（動作確認用）
    // 本番で邪魔なら削除OK
    // eslint-disable-next-line no-console
    console.log("[Wallet] connected:", isConnected, "address:", address, "chainId:", chainId);
  }, [isConnected, address, chainId]);

  const saveWalletToProfile = async () => {
    if (!user || !address) return;
    setSaving(true);
    try {
      // 例：profiles に primary_wallet を保存（profiles テーブルがある前提）
      const { error } = await supabase
        .from("profiles")
        .update({ primary_wallet: address })
        .eq("user_id", user.id);

      if (error) throw error;
      alert("Saved wallet to your profile.");
    } catch (e: any) {
      alert("Failed to save: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Connect your Ethereum wallet (MetaMask) and then proceed to Transfer.
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Status</div>
            <div className="text-sm">{isConnected ? "Connected" : "Disconnected"}</div>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <button
                className="bg-primary text-primary-foreground px-4 py-2 rounded"
                onClick={() => connect()}
                disabled={isConnPending}
              >
                {isConnPending ? "Connecting..." : "Connect MetaMask"}
              </button>
            ) : (
              <button className="px-4 py-2 rounded border" onClick={() => disconnect()}>
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">Address</div>
            <div className="font-mono break-all">{address || "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Short</div>
            <div>{short}</div>
          </div>
          <div>
            <div className="font-semibold">Network</div>
            <div>{chainId ? `Chain ID: ${chainId}` : "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Balance</div>
            <div>
              {balance ? `${balance.formatted} ${balance.symbol}` : "-"}
            </div>
          </div>
        </div>

        {connError && (
          <div className="text-destructive text-sm">
            {String(connError.message || connError)}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded border"
            onClick={saveWalletToProfile}
            disabled={!isConnected || !address || saving}
          >
            {saving ? "Saving..." : "Save to Profile"}
          </button>

          <Link to="/transfer" className="bg-secondary text-secondary-foreground px-4 py-2 rounded">
            Go to Transfer
          </Link>
        </div>
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        Tip: If nothing happens when you click “Connect MetaMask”, make sure MetaMask is installed and this site is
        allowed to connect in the extension popup.
      </div>
    </div>
  );
}
