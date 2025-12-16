
// src/pages/Wallets.tsx
// --- REFACTORED to use the central `useSIWE` hook for consistency and robustness. ---
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSIWE } from "@/hooks/useSIWE"; // Import the central hook

type WalletRow = { id: number; address: string; verified_at: string | null };

export default function WalletsPage() {
  const { user } = useAuth();
  const { verifyWalletOwnership, isVerifying } = useSIWE(); // Use the hook

  const [addressInput, setAddressInput] = useState("");
  const [message, setMessage] = useState<string>("");
  const [rows, setRows] = useState<WalletRow[]>([]);

  const load = async () => {
    if (!user) return;
    // Corrected to fetch from `wallet_connections` as per the final schema
    const { data, error } = await supabase
      .from("wallet_connections")
      .select("id, wallet_address, verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[wallets] load error:", error);
      setRows([]);
    } else {
      // Adapt to the correct column name `wallet_address`
      const mappedData = (data || []).map(d => ({ ...d, address: d.wallet_address }));
      setRows(mappedData as WalletRow[]);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleLink = async () => {
    setMessage("");
    if (!user) {
      setMessage("Please login first.");
      return;
    }
    const addr = addressInput.trim();
    if (!addr) {
      setMessage("Enter a wallet address.");
      return;
    }

    // Call the central verification function from the hook
    // Pass 'ethereum' as the wallet_type, as this page is for EVM wallets.
    const success = await verifyWalletOwnership(addr, 'ethereum');

    if (success) {
      setMessage("Wallet linked successfully!");
      setAddressInput("");
      await load(); // Refresh the list
    } else {
      // The hook's internal toast will show the error, but we can set a local message too if needed.
      setMessage("Linking failed. Check the notification for details.");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-2">Wallet Creation / Linking</h1>
      <p className="text-sm text-muted-foreground">
        Enter your EVM-compatible wallet address (e.g., MetaMask, Rainbow) and click the link button. A signature request will appear in your wallet.
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Wallet Address</label>
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="0x…"
          disabled={isVerifying}
        />
        <div className="flex gap-2">
          <button onClick={handleLink} disabled={isVerifying} className="px-4 py-2 rounded border disabled:opacity-50">
            {isVerifying ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        {message && <div className="text-sm mt-2">{message}</div>}
      </div>

      <hr className="my-6" />

      <h2 className="text-xl font-semibold">Your Linked Wallets</h2>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No linked wallets yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border rounded px-3 py-2 flex items-center justify-between">
              <span className="font-mono break-all">{r.address}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap pl-4">
                {r.verified_at ? `Verified: ${new Date(r.verified_at).toLocaleString()}` : "Not Verified"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
