// src/pages/wallet/WalletSelection.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Linked = { wallet_address: string; verified?: boolean; verified_at?: string | null };

export default function WalletSelection() {
  const [rows, setRows] = useState<Linked[]>([]);
  const [addr, setAddr] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("wallets")
      .select("wallet_address, verified, verified_at")
      .order("verified_at", { ascending: false });
    setRows((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const toast = (m: string) => alert(m);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Wallets</h1>

      <p className="text-sm text-muted-foreground">
        This page shows wallets linked to your account. New linking flow:
        enter address → sign message → done. Make sure the input address and signer are the same.
      </p>

      {/* quick link (PC/Phone) */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="border rounded px-2 py-1 min-w-[240px]"
          placeholder="0x..."
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
        />
        <button className="px-3 py-1.5 rounded border" onClick={() => toast("PC flow (MetaMask)")} >
          Link (PC)
        </button>
        <button className="px-3 py-1.5 rounded border" onClick={() => toast("Phone flow (WalletConnect)")} >
          Link (Phone)
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Linked wallets (DB)</h2>
        <ul className="list-disc ml-6 space-y-1">
          {rows.map((r, i) => (
            <li key={i}>
              {r.wallet_address} • {r.verified ? "verified" : "unverified"}{" "}
              {r.verified_at ? `• ${r.verified_at}` : ""}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground">None yet.</li>
          )}
        </ul>
      </div>

      {/* How-to with images (placeholders) */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">How to link</h2>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li>Choose <b>Link (PC)</b> for MetaMask on desktop, or <b>Link (Phone)</b> for WalletConnect.</li>
          <li>Input your wallet address and follow the prompt to sign a plain message (nonce).</li>
          <li>We verify the signature server-side and mark your wallet as verified.</li>
        </ol>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <img src="/assets/wallets/step1.png" alt="Step 1" className="border rounded" />
          <img src="/assets/wallets/step2.png" alt="Step 2" className="border rounded" />
          <img src="/assets/wallets/step3.png" alt="Step 3" className="border rounded" />
        </div>
        <p className="text-xs text-muted-foreground">
          (Placeholders) Put your screenshots in <code>/public/assets/wallets/</code> as step1.png–step3.png.
        </p>
      </div>
    </div>
  );
}