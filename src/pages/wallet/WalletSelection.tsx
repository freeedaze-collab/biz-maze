// 省略: imports は現状のままでOK
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
    return rows.some((r) => r.address?.toLowerCase() === normalizedInput.toLowerCase());
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  // 共通：nonce & verify
  const getNonce = async (token?: string) => {
    const r = await fetch(FN_URL, { method: "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) throw new Error(`Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`);
    return body.nonce as string;
  };

  const postVerify = async (payload: { address: string; signature: string; message: string }, token?: string) => {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: "verify", ...payload }),
    });
    const text = await r.text();
    let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    return body;
  };

  // personal_sign：順序差異に自動対応し、recover で整合チェック
  async function signAndRecover(opts: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    message: string;
    account: string;
  }): Promise<{ signature: string; recovered: string; usedOrder: "msg-first" | "addr-first" }> {
    const { request, message, account } = opts;

    // 1) MetaMask順 [message, address]
    try {
      const sig1 = await request({ method: "personal_sign", params: [message, account] }) as string;
      const rec1 = await recoverMessageAddress({ message, signature: sig1 });
      if (rec1.toLowerCase() === account.toLowerCase()) {
        return { signature: sig1, recovered: rec1, usedOrder: "msg-first" };
      }
    } catch (e) {
      // 続行して逆順を試す
    }

    // 2) 逆順 [address, message]（一部WalletConnect系）
    const sig2 = await request({ method: "personal_sign", params: [account, message] }) as string;
    const rec2 = await recoverMessageAddress({ message, signature: sig2 });
    return { signature: sig2, recovered: rec2, usedOrder: "addr-first" };
  }

  // MetaMask
  const handleLinkWithMetaMask = async () => {
    try {
      if (!user?.id) return alert("Please login again.");
      if (!normalizedInput || !isAddress(normalizedInput)) return alert("Please input a valid Ethereum address.");
      if (alreadyLinked) return alert("This wallet is already linked.");
      if (!(window as any).ethereum) return alert("MetaMask not found.");

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      setLinking("mm");

      const [current] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (!current) throw new Error("No MetaMask account. Please unlock MetaMask.");
      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert("The currently selected MetaMask account differs from the input address."); return;
      }

      const message = await getNonce(token);
      const { signature, recovered, usedOrder } = await signAndRecover({
        request: (args) => (window as any).ethereum.request(args),
        message, account: current,
      });

      if (recovered.toLowerCase() !== current.toLowerCase()) {
        throw new Error(`Signature mismatch (MetaMask). used=${usedOrder}, recovered=${recovered}, input=${current}`);
      }

      await postVerify({ address: current, signature, message }, token);
      setAddressInput(""); await load(); alert("Wallet linked (MetaMask).");
    } catch (e: any) {
      console.error("[wallets] mm error:", e); alert(e?.message ?? String(e));
    } finally { setLinking(null); }
  };

  // WalletConnect（クリック時にだけモーダル起動）
  const handleLinkWithWalletConnect = async () => {
    let provider: WCProvider | null = null;
    try {
      if (!user?.id) return alert("Please login again.");
      if (!normalizedInput || !isAddress(normalizedInput)) return alert("Please input a valid Ethereum address.");
      if (alreadyLinked) return alert("This wallet is already linked.");

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      setLinking("wc");

      provider = await createWCProvider();
      if (typeof provider.connect === "function") { await provider.connect(); }
      else { await provider.request({ method: "eth_requestAccounts" }); }

      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const current = accounts?.[0];
      if (!current) throw new Error("WalletConnect: no accounts.");
      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert("Selected account differs from the input address."); return;
      }

      const message = await getNonce(token);
      const { signature, recovered, usedOrder } = await signAndRecover({
        request: (args) => provider!.request(args),
        message, account: current,
      });

      if (recovered.toLowerCase() !== current.toLowerCase()) {
        throw new Error(`Signature mismatch (WalletConnect). used=${usedOrder}, recovered=${recovered}, input=${current}`);
      }

      await postVerify({ address: current, signature, message }, token);
      setAddressInput(""); await load(); alert("Wallet linked (WalletConnect).");
    } catch (e: any) {
      console.error("[wallets] wc error:", e); alert(e?.message ?? String(e));
    } finally {
      try { await provider?.disconnect?.(); } catch {}
      setLinking(null);
    }
  };

  // --- JSX はそのまま ---
  return (/* 既存の JSX そのまま */ null as any);
}
