
// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress, toHex, recoverMessageAddress } from "viem";
import { createWCProvider, WCProvider } from "@/lib/walletconnect";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";

// Updated type to match the 'wallet_connections' table schema
type WalletRow = {
  id: number;
  user_id: string;
  wallet_address: string; // Renamed from 'address'
  verified_at?: string | null; // This field indicates verification
};

const FN_URL = "https://ymddtgbsybvxfitgupqy.supabase.co/functions/v1/verify-2";

export default function WalletSelection() {
  const { user } = useAuth();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<"mm" | "wc" | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const normalizedInput = useMemo(() => addressInput?.trim(), [addressInput]);

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    // Use 'wallet_address' for comparison
    return rows.some(
      (r) => r.wallet_address?.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    // Read from the correct 'wallet_connections' table and select the correct columns
    const { data, error } = await supabase
      .from("wallet_connections")
      .select("id,user_id,wallet_address,verified_at")
      .eq("user_id", user.id)
      .order("verified_at", { ascending: false });

    if (error) {
      console.error("[wallets] load error:", error);
      setRows([]);
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- Nonce and Verify logic remains the same ----
  const getNonce = async (token?: string) => {
    const r = await fetch(FN_URL, {
      method: "GET",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) {
      throw new Error(
        `Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`
      );
    }
    return body.nonce as string;
  };

  const postVerify = async (
    payload: { address: string; signature: string; message: string },
    token?: string
  ) => {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: "verify", ...payload }),
    });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) {
      throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    }
    return body;
  };
  
  // ---- MetaMask and WalletConnect handlers remain the same ----
    const handleLinkWithMetaMask = async () => {
    try {
      if (!user?.id) { alert("Please login again."); return; }
      if (!normalizedInput || !isAddress(normalizedInput)) {
        alert("Please input a valid Ethereum address."); return;
      }
      if (alreadyLinked) { alert("This wallet is already linked."); return; }
      if (!(window as any).ethereum) { alert("MetaMask not found."); return; }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      setLinking("mm");

      const [current] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!current) throw new Error("No MetaMask account. Please unlock MetaMask.");

      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert("The currently selected MetaMask account differs from the input address.");
        return;
      }

      const message = await getNonce(token);

      const hexMsg = toHex(message);
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [hexMsg, current],
      });

      const recovered = await recoverMessageAddress({ message, signature });
      if (recovered.toLowerCase() !== current.toLowerCase()) {
        throw new Error(`Local recover mismatch: ${recovered} != ${current}`);
      }

      await postVerify({ address: current, signature, message }, token);
      setAddressInput("");
      await load();
      alert("Wallet linked (MetaMask).");
    } catch (e: any) {
      console.error("[wallets] mm error:", e);
      alert(e?.message ?? String(e));
    } finally {
      setLinking(null);
    }
  };

  const handleLinkWithWalletConnect = async () => {
    let provider: WCProvider | null = null;
    try {
      if (!user?.id) { alert("Please login again."); return; }
      if (!normalizedInput || !isAddress(normalizedInput)) {
        alert("Please input a valid Ethereum address."); return;
      }
      if (alreadyLinked) { alert("This wallet is already linked."); return; }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      setLinking("wc");

      provider = await createWCProvider();

      if (typeof provider.connect === "function") {
        await provider.connect();
      } else {
        await provider.request({ method: "eth_requestAccounts" });
      }

      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      const current = accounts?.[0];
      if (!current) throw new Error("WalletConnect: no accounts.");

      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert("Selected account differs from the input address.");
        return;
      }

      const message = await getNonce(token);

      const hexMsg = toHex(message);
      const signature = (await provider.request({
        method: "personal_sign",
        params: [hexMsg, current],
      })) as string;

      const recovered = await recoverMessageAddress({ message, signature });
      if (recovered.toLowerCase() !== current.toLowerCase()) {
        throw new Error(`Local recover mismatch: ${recovered} != ${current}`);
      }

      await postVerify({ address: current, signature, message }, token);
      setAddressInput("");
      await load();
      alert("Wallet linked (WalletConnect).");
    } catch (e: any) {
      console.error("[wallets] wc error:", e);
      alert(e?.message ?? String(e));
    } finally {
      try { await provider?.disconnect?.(); } catch {}
      setLinking(null);
    }
  };

  return (
    <AppPageLayout
      title="Wallets"
      description="Link wallets to your account, verify ownership, and keep your ledger in sync."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="border rounded-2xl p-5 bg-white/80 shadow-sm space-y-3">
          <div>
            <p className="text-sm font-semibold">Add a wallet</p>
            <p className="text-sm text-muted-foreground">Enter the address, sign the nonce, and confirm.</p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Wallet Address</label>
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="0x..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleLinkWithMetaMask}
                disabled={linking !== null}
                title="Sign with MetaMask"
              >
                {linking === "mm" ? "Linking..." : "Link (MetaMask)"}
              </Button>
              <Button
                variant="outline"
                onClick={handleLinkWithWalletConnect}
                disabled={linking !== null}
                title="Sign with WalletConnect (mobile / no extension)"
              >
                {linking === "wc" ? "Linking..." : "Link (WalletConnect)"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The signing message is a server-issued nonce. Make sure the input address and signer address match exactly.
          </p>
          {alreadyLinked && (
            <p className="text-xs text-green-700">This address is already linked.</p>
          )}
        </div>

        <div className="border rounded-2xl p-5 bg-white/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">Linked wallets</p>
              <p className="text-xs text-muted-foreground">Only addresses linked to this account are shown.</p>
            </div>
            {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
          </div>
          {loading ? null : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No linked wallets yet.</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((w) => (
                <li key={w.id} className="border rounded-xl p-3 bg-white/70">
                  {/* Display 'wallet_address' */}
                  <div className="font-mono break-all">{w.wallet_address}</div>
                  <div className="text-xs text-muted-foreground">
                    {/* Determine status from 'verified_at' and display the date */}
                    {w.verified_at ? `verified • ${new Date(w.verified_at).toLocaleString()}` : "unverified"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppPageLayout>
  );
}
