// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress } from "viem";
import { initWalletConnect, type WCProvider } from "@/lib/walletconnect";

// Edge Function のフル URL を .env から
// 例: VITE_FUNCTION_VERIFY_WALLET=https://<ref>.functions.supabase.co/functions/v1/verify-wallet-signature
const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET as string;

type WalletRow = {
  id: number;
  user_id: string;
  address: string;
  created_at?: string | null;
  verified?: boolean | null;
};

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

    // network列が無い環境で42703回避のため列は最小限
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

  // ---------- 共通：nonce（= message）を GET ----------
  const getNonce = async (token?: string) => {
    const r = await fetch(FN_URL, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) {
      throw new Error(
        `Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`
      );
    }
    return body.nonce as string;
  };

  // ---------- 共通：verify（POST） ----------
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
      // Edge Function 側は { action:'verify', address, signature, message } を期待
      body: JSON.stringify({ action: "verify", ...payload }),
    });
    const raw = await r.text();
    let body: any = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }

    if (!r.ok || !body?.ok) {
      throw new Error(
        `Verify failed. status=${r.status}, body=${JSON.stringify(body)}`
      );
    }
    return body;
  };

  // ---------- 共通：local recover（ブラウザ側で即復元してズレ検知） ----------
  // viem UMD を一度だけロード
  async function ensureViem(): Promise<any> {
    // すでに import 済みなら window.viem があるケースもある
    if ((window as any).viem?.recoverMessageAddress) return (window as any).viem;
    // UMDロード（確実なミラー）
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src =
        "https://unpkg.com/viem@2.18.8/dist/umd/index.min.js";
      s.onload = () => res();
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return (window as any).viem;
  }

  async function signWithPersonalSign(
    provider: any,
    message: string,
    signer: string
  ): Promise<string> {
    // personal_sign の param 順は実装差があるので両順フォールバック
    try {
      return (await provider.request({
        method: "personal_sign",
        params: [message, signer],
      })) as string;
    } catch {
      return (await provider.request({
        method: "personal_sign",
        params: [signer, message],
      })) as string;
    }
  }

  // ---------- MetaMask（拡張機能） ----------
  const handleLinkWithMetaMask = async () => {
    try {
      if (!user?.id) {
        alert("Please login again.");
        return;
      }
      if (!normalizedInput || !isAddress(normalizedInput)) {
        alert("Please input a valid Ethereum address.");
        return;
      }
      if (alreadyLinked) {
        alert("This wallet is already linked.");
        return;
      }
      if (!(window as any).ethereum) {
        alert("MetaMask not found.");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      setLinking("mm");

      // 署名者（MetaMask 現在アカウント）
      const [current] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!current) throw new Error("No MetaMask account.");

      // 入力と MetaMask の署名者が違うと不一致になるので明示チェック
      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert(
          "Selected MetaMask account differs from the input address. Please switch your account."
        );
        return;
      }

      // 1) GET nonce（= 文字列 message）
      const nonce = await getNonce(token);

      // 2) 署名（フォールバック順）
      const signature = await signWithPersonalSign(
        (window as any).ethereum,
        nonce,
        current
      );

      // 2.5) ローカル即復元チェック（デバッグ可視化）
      const viem = await ensureViem();
      const recoveredLocal = await viem.recoverMessageAddress({
        message: nonce,
        signature,
      });
      console.log("[local recover mm]", {
        input: current,
        recoveredLocal,
        same:
          recoveredLocal?.toLowerCase() === current?.toLowerCase(),
      });

      // 3) verify（Edge Function は {message} を検証に使う）
      await postVerify(
        { address: current, signature, message: nonce },
        token
      );

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

  // ---------- WalletConnect（拡張機能不要 / スマホ通常ブラウザOK） ----------
  const handleLinkWithWalletConnect = async () => {
    let provider: WCProvider | null = null;
    try {
      if (!user?.id) {
        alert("Please login again.");
        return;
      }
      if (!normalizedInput || !isAddress(normalizedInput)) {
        alert("Please input a valid Ethereum address.");
        return;
      }
      if (alreadyLinked) {
        alert("This wallet is already linked.");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      setLinking("wc");

      provider = await initWalletConnect();
      await provider.enable();

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const current = accounts?.[0];
      if (!current) throw new Error("WalletConnect: no accounts.");

      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert(
          "Selected wallet account differs from the input address. Please switch your account."
        );
        return;
      }

      // 1) GET nonce
      const nonce = await getNonce(token);

      // 2) 署名（フォールバック順）
      const signature = await signWithPersonalSign(
        provider,
        nonce,
        current
      );

      // 2.5) ローカル即復元チェック
      const viem = await ensureViem();
      const recoveredLocal = await viem.recoverMessageAddress({
        message: nonce,
        signature,
      });
      console.log("[local recover wc]", {
        input: current,
        recoveredLocal,
        same:
          recoveredLocal?.toLowerCase() === current?.toLowerCase(),
      });

      // 3) verify
      await postVerify(
        { address: current, signature, message: nonce },
        token
      );

      setAddressInput("");
      await load();
      alert("Wallet linked (WalletConnect).");
    } catch (e: any) {
      console.error("[wallets] wc error:", e);
      alert(e?.message ?? String(e));
    } finally {
      try {
        await provider?.disconnect?.();
      } catch {}
      setLinking(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        あなたのアカウントに紐づくウォレットのみ表示されます。
        新規連携は<strong>アドレス入力 → 署名 → 完了</strong>の順です。
      </p>

      {/* 入力 → 署名 → 完了 */}
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
          署名メッセージはサーバ発行の <code>nonce</code>（=純テキスト）です。
          <br />
          入力アドレスと署名者アドレスは<strong>必ず同じ</strong>にしてください。
        </p>
        {alreadyLinked && (
          <p className="text-xs text-green-700">This address is already linked.</p>
        )}
      </div>

      {/* 連携済み一覧（DB） */}
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
