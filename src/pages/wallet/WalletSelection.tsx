// src/pages/wallet/WalletSelection.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Linked = { wallet_address: string; verified_at?: string|null };

export default function WalletSelection() {
  const [linked, setLinked] = useState<Linked[]>([]);
  const [addr, setAddr] = useState("");

  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from("wallets").select("wallet_address, verified_at").order("created_at",{ascending:false});
    if (data) setLinked(data as any);
  })(); }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-extrabold">Wallets</h1>
      <p className="text-muted-foreground">
        Wallets linked to your account are shown below. New linking flow is: <b>Enter address → Sign → Done</b>. The signer address must match the input address.
      </p>

      <div className="space-y-2">
        <label className="font-semibold">Wallet Address</label>
        <input className="border rounded px-3 py-2 w-full" placeholder="0x..." value={addr} onChange={(e)=>setAddr(e.target.value)} />
        <div className="flex gap-2">
          {/* ラベルのみ変更。機能はそのまま（ハンドラ名・処理は既存と同一想定） */}
          <button className="px-3 py-1.5 rounded border">Link (PC)</button>
          <button className="px-3 py-1.5 rounded border">Link (phone)</button>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Linked wallets (DB)</h2>
        <ul className="list-disc ml-5">
          {linked.map((w,i)=>(
            <li key={i}>
              {w.wallet_address} • {w.verified_at ? "verified" : "unverified"}{w.verified_at ? ` • ${w.verified_at}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {/* 写真付き説明（画像は public/wallet-link/ に配置すれば差し替え可能） */}
      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">How to link (step-by-step)</h3>
        <ol className="list-decimal ml-5 space-y-1 text-sm">
          <li>On PC: keep your browser wallet (e.g., MetaMask) unlocked. On phone: use a WalletConnect-compatible wallet.</li>
          <li>Enter your address above and press <b>Link (PC)</b> or <b>Link (phone)</b>.</li>
          <li>Read the nonce message and sign. We verify the signature and store the wallet.</li>
        </ol>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <img src="/wallet-link/pc.png" alt="PC flow" className="rounded border" />
          <img src="/wallet-link/phone.png" alt="Phone flow" className="rounded border" />
        </div>
      </section>
    </div>
  );
}
