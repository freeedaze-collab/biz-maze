// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress } from "viem";

type WalletRow = {
  id: number;
  user_id: string;
  address: string;
  created_at?: string | null;
};

export default function WalletSelection() {
  const { user } = useAuth();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [addressInput, setAddressInput] = useState("");
  const normalizedInput = useMemo(() => addressInput.trim(), [addressInput]);

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
      .select("id,user_id,address,created_at") // ← 最小列のみ
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

  const getSignerAddress = async (): Promise<string> => {
    const eth = (window as any).ethereum;
    if (!eth?.request) throw new Error("Please install MetaMask.");
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    const current = accounts?.[0];
    if (!current) throw new Error("No wallet account connected.");
    return current;
  };

  const fetchNonce = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("verify-wallet-signature", {
      body: { action: "nonce" },
    });
    if (error) {
      throw new Error(
        `Nonce request failed via invoke.\n${JSON.stringify(error, null, 2)}`
      );
    }
    const n = (data as any)?.nonce;
    if (!n) throw new Error(`Nonce not returned.\nRaw: ${JSON.stringify(data)}`);
    return n as string;
  };

  const signMessage = async (msg: string, signerAddr: string): Promise<string> => {
    const eth = (window as any).ethereum;
    if (!eth?.request) throw new Error("MetaMask not found.");
    return await eth.request({
      method: "personal_sign",
      params: [msg, signerAddr], // personal_sign は [message, address]
    });
  };

  const handleLink = async () => {
    setMessage("");

    if (!user?.id) return alert("Please login again.");
    if (!normalizedInput) return alert("Please input your wallet address.");
    if (!isAddress(normalizedInput)) return alert("Invalid Ethereum address format.");
    if (alreadyLinked) return alert("This wallet is already linked to your account.");

    setLinking(true);
    try {
      const signerAddr = await getSignerAddress();

      if (signerAddr.toLowerCase() !== normalizedInput.toLowerCase()) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }],
          });
        } catch {}
        throw new Error(
          "The connected MetaMask account is different from the input address.\n" +
            "Please switch MetaMask to the input address and try again."
        );
      }

      const nonce = await fetchNonce();
      const signature = await signMessage(nonce, signerAddr);

      const { data: verifyData, error: verifyErr } =
        await supabase.functions.invoke("verify-wallet-signature", {
          body: {
            action: "verify",
            address: normalizedInput,
            signature,
            nonce,
          },
        });

      if (verifyErr) {
        throw new Error(
          `Verify request failed via invoke.\n${JSON.stringify(verifyErr, null, 2)}`
        );
      }
      if (!(verifyData as any)?.ok) {
        throw new Error(`Verification failed.\nRaw: ${JSON.stringify(verifyData)}`);
      }

      setAddressInput("");
      await load();
      setMessage("Wallet has been linked successfully.");
      alert("Wallet has been linked successfully.");
    } catch (e: any) {
      console.error("[wallets] link error:", e);
      alert(`Link failed: ${e?.message ?? e}`);
      setMessage(e?.message ?? String(e));
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        入力したウォレットアドレスで MetaMask 署名による本人確認を行い、
        承認後にあなたのアカウントへリンクします（他人のウォレットは表示されません）。
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
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        {message && <div className="text-xs mt-2">{message}</div>}
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
