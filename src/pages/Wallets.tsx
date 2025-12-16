// src/pages/Wallets.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WalletRow = { id: number; address: string; verified_at: string | null };

export default function WalletsPage() {
  const { user } = useAuth();
  const [addressInput, setAddressInput] = useState("");
  const [nonce, setNonce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [rows, setRows] = useState<WalletRow[]>([]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wallets")
      .select("id,address,verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[wallets] load error:", error);
      setRows([]);
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const getNonce = async () => {
    const { data, error } = await supabase.functions.invoke("verify-2", {
      body: { action: "nonce" },
    });
    if (error) throw error;
    return (data as any)?.nonce as string;
  };

  const signWithMetaMask = async (msg: string) => {
    const eth = (window as any).ethereum;
    if (!eth?.request) throw new Error("MetaMask not found");
    const signature = await eth.request({
      method: "personal_sign",
      params: [msg],
    });
    if (typeof signature !== "string") throw new Error("Signature failed");
    return signature as string;
  };

  const handleLink = async () => {
    try {
      setBusy(true);
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

      const n = nonce ?? (await getNonce());
      setNonce(n);

      const sig = await signWithMetaMask(n);

      const { data, error } = await supabase.functions.invoke("verify-2", {
        body: { action: "verify", address: addr, nonce: n, signature: sig },
      });

      if (error) {
        console.error("[wallets] link error:", error);
        const msg = (error as any)?.message ?? JSON.stringify(error);
        setMessage(`Link failed: ${msg}`);
        return;
      }

      const resp = data as any;
      if (!resp?.ok) {
        setMessage(`Link failed: ${JSON.stringify(resp)}`);
        return;
      }

      setMessage("Linked successfully.");
      setAddressInput("");
      setNonce(null);
      await load();
    } catch (e: any) {
      console.error("[wallets] link exception:", e);
      setMessage(`Link failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-2">Wallet Creation / Linking</h1>
      <p className="text-sm text-muted-foreground">
        Enter your wallet address, then click <b>Link (PC)</b> or <b>Link (phone)</b>. A MetaMask signature window will open on PC.
        We’ll verify the signature and register the address to your account.
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Wallet Address</label>
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="0x…"
        />
        <div className="flex gap-2">
          <button onClick={handleLink} disabled={busy} className="px-4 py-2 rounded border disabled:opacity-50">
            {busy ? "Linking..." : "Link (PC)"}
          </button>
          <button onClick={handleLink} disabled={busy} className="px-4 py-2 rounded border disabled:opacity-50">
            {busy ? "Linking..." : "Link (phone)"}
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
              <span className="font-mono">{r.address}</span>
              <span className="text-xs text-muted-foreground">
                {r.verified_at ? new Date(r.verified_at).toLocaleString() : "-"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">How to link (step-by-step)</h3>
        <ol className="list-decimal ml-5 space-y-1 text-sm">
          <li>On PC: keep your browser wallet (e.g., MetaMask) unlocked. On phone: open a WalletConnect-compatible app.</li>
          <li>Enter your address above and press <b>Link (PC)</b> or <b>Link (phone)</b>.</li>
          <li>Read the nonce message and sign. We verify the signature and store the wallet.</li>
        </ol>
        <div className="text-xs text-muted-foreground">
          * Place images under <code>public/wallet-link/</code> (e.g., <code>pc.png</code>, <code>phone.png</code>) to show visual guides here.
        </div>
      </section>
    </div>
  );
}
