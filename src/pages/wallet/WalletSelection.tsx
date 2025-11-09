// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress, recoverMessageAddress } from "viem";
import { createWCProvider, WCProvider } from "@/lib/walletconnect";

type WalletRow = {
  id: number;
  user_id: string;
  address: string;
  created_at?: string | null;
  verified?: boolean | null;
};

const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET as string;

export default function WalletSelection() {
  const { user } = useAuth();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<"mm" | "wc" | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const normalizedInput = useMemo(() => addressInput?.trim(), [addressInput]);

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some(
      (r) => r.address?.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallets")
      .select("id,user_id,address,created_at,verified")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

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

  // ---- 共通：message取得（GET）
  const getMessage = async (token?: string) => {
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
    // サーバは nonce を “素の文字列”として返す → これを message としてそのまま署名する
    return body.nonce as string;
  };

  // ---- 共通：verify（POST）
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

  // ---- MetaMask（拡張機能）
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

      const message = await getMessage(token);
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [message, current], // message, signer
      });

      // --- 署名直後に “ローカルrecover” で same:true を確認（デバッグ）
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

  // ---- WalletConnect（モバイル／拡張機能なし）
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
        await provider.connect(); // ユーザー操作で QR モーダルを開く
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

      const message = await getMessage(token);
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, current],
      })) as string;

      // --- ローカルrecoverで確認
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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        あなたのアカウントに紐づくウォレットのみ表示されます。新規連携は
        <strong>アドレス入力 → 署名 → 完了</strong>の順です。
      </p>

      <div className="border rounded-xl p-4 space-y-3">
        <label className="text-sm font-medium">Wallet Address</label>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="0x..."
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            autoComplete="off"
          />
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={handleLinkWithMetaMask}
            disabled={linking !== null}
            title="Sign with MetaMask"
          >
            {linking === "mm" ? "Linking..." : "Link (MetaMask)"}
          </button>
          <button
            className="px-3 py-2 rounded border disabled:opacity-50"
            onClick={handleLinkWithWalletConnect}
            disabled={linking !== null}
            title="Sign with WalletConnect (mobile / no extension)"
          >
            {linking === "wc" ? "Linking..." : "Link (WalletConnect)"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          署名メッセージはサーバ発行の <code>message</code>（素の文字列）です。
          入力アドレスと署名者のアドレスは<strong>必ず同じ</strong>にしてください。
        </p>
        {alreadyLinked && (
          <p className="text-xs text-green-700">This address is already linked.</p>
        )}
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Linked wallets (DB)</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No linked wallets yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((w) => (
              <li key={w.id} className="border rounded p-3">
                <div className="font-mono break-all">{w.address}</div>
                <div className="text-xs text-muted-foreground">
                  {w.verified ? "verified" : "unverified"} • {w.created_at ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}