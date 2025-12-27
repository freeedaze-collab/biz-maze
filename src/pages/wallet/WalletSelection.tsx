
// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress, toHex, recoverMessageAddress } from "viem";
import { createWCProvider, WCProvider } from "@/lib/walletconnect";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

type WalletRow = {
  id: number;
  user_id: string;
  wallet_address: string;
  verified_at?: string | null;
};

// --- Data Structures for Accordion ---
const WALLET_PROVIDERS = [
  {
    name: 'MetaMask',
    slug: 'metamask',
    chains: [{ name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Sign with the browser extension.' }]
  },
  {
    name: 'WalletConnect',
    slug: 'walletconnect',
    chains: [{ name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'Sign via QR code or mobile wallet.' }]
  },
  {
    name: 'Phantom',
    slug: 'phantom',
    chains: [
      { name: 'Solana', slug: 'sol', description: 'Native Solana signing (coming soon).' },
      { name: 'Ethereum (EVM)', slug: 'eth-evm', description: 'EVM signing via Phantom (coming soon).' }
    ]
  }
];

const FN_URL = "https://yelkjimxejmrkfzeumos.supabase.co/functions/v1/verify-2";

export default function WalletSelection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const normalizedInput = useMemo(() => addressInput?.trim(), [addressInput]);
  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some(r => r.wallet_address?.toLowerCase() === normalizedInput.toLowerCase());
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_connections")
      .select("id,user_id,wallet_address,verified_at")
      .eq("user_id", user.id)
      .order("verified_at", { ascending: false });

    if (error) {
      console.error("[wallets] load error:", error);
      toast({ variant: "destructive", title: "Error loading wallets", description: error.message });
      setRows([]);
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const getNonce = async (token?: string) => {
    const r = await fetch(FN_URL, {
      method: "GET",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) {
      throw new Error(`Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`);
    }
    return body.nonce as string;
  };

  const postVerify = async (payload: { address: string; signature: string; message: string }, token?: string) => {
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

  const handleLink = async (providerSlug: string) => {
    if (!user?.id) {
        toast({ variant: "destructive", title: "Please login again." });
        return;
    }
    if (!normalizedInput || !isAddress(normalizedInput)) {
        toast({ variant: "destructive", title: "Invalid Address", description: "Please input a valid Ethereum address." });
        return;
    }
    if (alreadyLinked) {
        toast({ variant: "destructive", title: "Already Linked", description: "This wallet is already linked to your account." });
        return;
    }

    if (providerSlug === 'metamask') {
        await handleLinkWithMetaMask();
    } else if (providerSlug === 'walletconnect') {
        await handleLinkWithWalletConnect();
    } else {
        toast({ title: "Coming Soon", description: "This wallet provider is not yet supported." });
    }
  }

  const handleLinkWithMetaMask = async () => {
    setLinking("metamask");
    try {
      if (!(window as any).ethereum) {
        throw new Error("MetaMask not found. Please install the browser extension.");
      }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;

      const [current] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (!current) throw new Error("No MetaMask account. Please unlock MetaMask.");
      if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
        throw new Error("The currently selected MetaMask account differs from the input address.");
      }

      const message = await getNonce(token);
      const hexMsg = toHex(message);
      const signature = await (window as any).ethereum.request({ method: "personal_sign", params: [hexMsg, current] });

      await postVerify({ address: current, signature, message }, token);
      setAddressInput("");
      await load();
      toast({ title: "Wallet Linked!", description: "Successfully linked with MetaMask." });
    } catch (e: any) {
      console.error("[wallets] mm error:", e);
      toast({ variant: "destructive", title: "MetaMask Error", description: e?.message ?? String(e) });
    } finally {
      setLinking(null);
    }
  };

  const handleLinkWithWalletConnect = async () => {
    let provider: WCProvider | null = null;
    setLinking("walletconnect");
    try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;

        provider = await createWCProvider();
        if (typeof provider.connect === "function") await provider.connect();
        else await provider.request({ method: "eth_requestAccounts" });
        
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        const current = accounts?.[0];
        if (!current) throw new Error("WalletConnect: no accounts found.");
        if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
            throw new Error("Selected account in WalletConnect differs from the input address.");
        }

        const message = await getNonce(token);
        const hexMsg = toHex(message);
        const signature = (await provider.request({ method: "personal_sign", params: [hexMsg, current] })) as string;
        
        await postVerify({ address: current, signature, message }, token);
        setAddressInput("");
        await load();
        toast({ title: "Wallet Linked!", description: "Successfully linked with WalletConnect." });
    } catch (e: any) {
      console.error("[wallets] wc error:", e);
      toast({ variant: "destructive", title: "WalletConnect Error", description: e?.message ?? String(e) });
    } finally {
      try { await provider?.disconnect?.(); } catch {}
      setLinking(null);
    }
  };

  return (
    <AppPageLayout title="Wallets" description="Link wallets to your account, verify ownership, and keep your ledger in sync.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Add a wallet</CardTitle>
            <CardDescription>Enter the address, then choose a wallet to sign and confirm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Wallet Address</label>
              <Input
                placeholder="0x..."
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                autoComplete="off"
                disabled={!!linking}
              />
              {alreadyLinked && (
                <p className="text-xs text-green-700 mt-1">This address is already linked.</p>
              )}
            </div>
            <Accordion type="single" collapsible className="w-full">
              {WALLET_PROVIDERS.map(provider => (
                <AccordionItem key={provider.slug} value={provider.slug}>
                  <AccordionTrigger>{provider.name}</AccordionTrigger>
                  <AccordionContent>
                    {provider.chains.map(chain => (
                      <div key={chain.slug} className="pt-2">
                        <p className="text-sm text-muted-foreground mb-2">{chain.description}</p>
                        <Button
                          onClick={() => handleLink(provider.slug)}
                          disabled={!!linking || !normalizedInput}
                          className="w-full"
                        >
                          {linking === provider.slug ? 'Linking...' : `Link (${provider.name})`}
                        </Button>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

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
                  <div className="font-mono break-all">{w.wallet_address}</div>
                  <div className="text-xs text-muted-foreground">
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
