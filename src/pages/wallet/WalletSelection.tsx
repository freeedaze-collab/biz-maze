// WalletSelection.tsx
import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function WalletSelection() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [manualAddress, setManualAddress] = useState("");

  const saveAddress = async (addr: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ primary_wallet: addr }).eq("user_id", user.id);
    alert("Wallet address saved!");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Wallet Creation / Linking</h1>

      {/* MetaMask 接続 */}
      {!isConnected ? (
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => connect()}
        >
          Connect MetaMask
        </button>
      ) : (
        <div>
          <p>Connected: {address}</p>
          <p>Balance: {balance?.formatted} {balance?.symbol}</p>
          <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => disconnect()}>
            Disconnect
          </button>
          <button className="ml-2 bg-green-500 text-white px-4 py-2 rounded" onClick={() => saveAddress(address!)}>
            Save to Profile
          </button>
        </div>
      )}

      {/* 手動入力 fallback */}
      <div className="mt-6">
        <label className="block font-semibold">Manual Address</label>
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          className="border px-2 py-1 w-full"
          placeholder="0x..."
        />
        <button
          className="mt-2 bg-gray-500 text-white px-4 py-2 rounded"
          disabled={!/^0x[a-fA-F0-9]{40}$/.test(manualAddress)}
          onClick={() => saveAddress(manualAddress)}
        >
          Save manual address
        </button>
      </div>
    </div>
  );
}
