
// src/pages/wallet/WalletSelection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress, toHex } from "viem";
import { createWCProvider, WCProvider } from "@/lib/walletconnect";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; };

// --- Data Structures for Accordion ---
const WALLET_PROVIDERS = [
  {
    name: 'MetaMask',
    slug: 'metamask',
    chains: [
      { name: 'Ethereum (EVM)', slug: 'metamask-eth', description: 'Sign with the browser extension.', handler: 'metamask' },
    ]
  },
  {
    name: 'WalletConnect',
    slug: 'walletconnect',
    chains: [
      { name: 'Ethereum (EVM)', slug: 'walletconnect-eth', description: 'Sign via QR code or mobile wallet.', handler: 'walletconnect' },
    ]
  },
  {
    name: 'Phantom',
    slug: 'phantom',
    chains: [
      { name: 'Solana', slug: 'phantom-sol', description: 'Native Solana signing (coming soon).' },
      { name: 'Ethereum (EVM)', slug: 'phantom-eth', description: 'EVM signing via Phantom (coming soon).' },
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
  const [addressInputs, setAddressInputs] = useState<{ [key: string]: string }>({});

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("wallet_connections").select("id,user_id,wallet_address,verified_at").eq("user_id", user.id).order("verified_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Error loading wallets", description: error.message });
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const getNonce = async (token?: string) => {
    const r = await fetch(FN_URL, { method: "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) throw new Error(`Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`);
    return body.nonce as string;
  };

  const postVerify = async (payload: { address: string; signature: string; message: string }, token?: string) => {
    const r = await fetch(FN_URL, { method: "POST", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "verify", ...payload }) });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    return body;
  };

  const handleInputChange = (slug: string, value: string) => {
    setAddressInputs(prev => ({ ...prev, [slug]: value }));
  };

  const handleLink = async (chain: { slug: string; handler?: string; }) => {
    const { slug: chainSlug, handler } = chain;
    const address = addressInputs[chainSlug]?.trim();
    const alreadyLinked = rows.some(r => r.wallet_address?.toLowerCase() === address?.toLowerCase());

    if (!user?.id) { toast({ variant: "destructive", title: "Please login again." }); return; }
    if (!address || !isAddress(address)) { toast({ variant: "destructive", title: "Invalid Address", description: "Please input a valid Ethereum address." }); return; }
    if (alreadyLinked) { toast({ variant: "destructive", title: "Already Linked", description: "This wallet is already linked to your account." }); return; }

    if (handler === 'metamask') await handleLinkWithMetaMask(address, chainSlug);
    else if (handler === 'walletconnect') await handleLinkWithWalletConnect(address, chainSlug);
    else toast({ title: "Coming Soon", description: "This wallet provider is not yet supported." });
  }

  const sharedLinkLogic = async (address: string, chainSlug: string, action: (address: string, token: string | undefined) => Promise<any>) => {
    setLinking(chainSlug);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      await action(address, token);
      setAddressInputs(prev => ({ ...prev, [chainSlug]: '' }));
      await load();
      toast({ title: "Wallet Linked!", description: "Successfully linked wallet." });
    } catch (e: any) {
      console.error(`[wallets] ${chainSlug} error:`, e);
      toast({ variant: "destructive", title: "Linking Error", description: e?.message ?? String(e) });
    } finally {
      setLinking(null);
    }
  }

  const handleLinkWithMetaMask = async (address: string, chainSlug: string) => {
    await sharedLinkLogic(address, chainSlug, async (address, token) => {
      if (!(window as any).ethereum) throw new Error("MetaMask not found. Please install the browser extension.");
      const [current] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (!current) throw new Error("No MetaMask account. Please unlock MetaMask.");
      if (current.toLowerCase() !== address.toLowerCase()) throw new Error("The currently selected MetaMask account differs from the input address.");
      const message = await getNonce(token);
      const hexMsg = toHex(message);
      const signature = await (window as any).ethereum.request({ method: "personal_sign", params: [hexMsg, current] });
      return postVerify({ address: current, signature, message }, token);
    });
  }

  const handleLinkWithWalletConnect = async (address: string, chainSlug: string) => {
    let provider: WCProvider | null = null;
    await sharedLinkLogic(address, chainSlug, async (address, token) => {
        provider = await createWCProvider();
        if (typeof provider.connect === "function") await provider.connect(); else await provider.request({ method: "eth_requestAccounts" });
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        const current = accounts?.[0];
        if (!current) throw new Error("WalletConnect: no accounts found.");
        if (current.toLowerCase() !== address.toLowerCase()) throw new Error("Selected account in WalletConnect differs from the input address.");
        const message = await getNonce(token);
        const hexMsg = toHex(message);
        const signature = (await provider.request({ method: "personal_sign", params: [hexMsg, current] })) as string;
        await postVerify({ address: current, signature, message }, token);
    }).finally(async () => {
        try { await provider?.disconnect?.(); } catch {}
    });
  }

  return (
    <AppPageLayout title="Wallets" description="Link wallets to your account, verify ownership, and keep your ledger in sync.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Add a wallet</CardTitle>
            <CardDescription>Choose a provider, select a network, enter your address, and sign.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {WALLET_PROVIDERS.map(provider => (
                <AccordionItem key={provider.slug} value={provider.slug}>
                  <AccordionTrigger>{provider.name}</AccordionTrigger>
                  <AccordionContent className="p-1">
                    <Accordion type="single" collapsible className="w-full">
                      {provider.chains.map(chain => {
                        const address = addressInputs[chain.slug] || '';
                        const isLinked = !!address && rows.some(r => r.wallet_address?.toLowerCase() === address.toLowerCase());
                        return (
                          <AccordionItem key={chain.slug} value={chain.slug}>
                            <AccordionTrigger className="text-sm">{chain.name}</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-3 px-1">
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Wallet Address</label>
                                <Input
                                  placeholder="0x..."
                                  value={address}
                                  onChange={(e) => handleInputChange(chain.slug, e.target.value)}
                                  autoComplete="off"
                                  disabled={!!linking}
                                />
                                {isLinked && <p className="text-xs text-green-700 mt-1">This address is already linked.</p>}
                              </div>
                              <div className="pt-3 border-t">
                                <p className="text-xs text-muted-foreground mb-2">{chain.description}</p>
                                <Button
                                  onClick={() => handleLink(chain)}
                                  disabled={!!linking || !address || isLinked}
                                  className="w-full"
                                  size="sm"
                                >
                                  {linking === chain.slug ? 'Linking...' : `Link Wallet`}
                                </Button>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
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
              <p className="text-xs text-muted-foreground">Only addresses from this account are shown.</p>
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
