
// src/pages/wallet/WalletSelection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress as isEVMAddress, toHex } from "viem";
import { createWCProvider, WCProvider } from "@/lib/walletconnect";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { encode } from "https://esm.sh/bs58@5.0.0";

type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; };

// --- Data Structures for Accordion ---
const WALLET_PROVIDERS = [
  {
    name: 'MetaMask',
    slug: 'metamask',
    chains: [
      { name: 'Ethereum', slug: 'metamask-eth', description: 'Sign with your Ethereum wallet.', handler: 'metamask', chain: 'ethereum' },
      { name: 'Polygon', slug: 'metamask-polygon', description: 'Sign with your Polygon wallet.', handler: 'metamask', chain: 'polygon' },
      { name: 'BNB Chain', slug: 'metamask-bnb', description: 'Sign with your BNB Chain wallet.', handler: 'metamask', chain: 'bnb chain' },
      { name: 'Avalanche', slug: 'metamask-avax', description: 'Sign with your Avalanche wallet.', handler: 'metamask', chain: 'avalanche' },
      { name: 'Arbitrum', slug: 'metamask-arb', description: 'Sign with your Arbitrum wallet.', handler: 'metamask', chain: 'arbitrum' },
      { name: 'Optimism', slug: 'metamask-op', description: 'Sign with your Optimism wallet.', handler: 'metamask', chain: 'optimism' },
      { name: 'Base', slug: 'metamask-base', description: 'Sign with your Base wallet.', handler: 'metamask', chain: 'base' },
      { name: 'Solana', slug: 'metamask-sol', description: 'Solana support is coming soon.' },
      { name: 'Bitcoin', slug: 'metamask-btc', description: 'Bitcoin support is coming soon.' },
    ]
  },
  {
    name: 'WalletConnect',
    slug: 'walletconnect',
    chains: [
      { name: 'Ethereum (EVM)', slug: 'walletconnect-eth', description: 'Sign via QR code or mobile wallet.', handler: 'walletconnect', chain: 'ethereum' },
    ]
  },
  {
    name: 'Phantom',
    slug: 'phantom',
    chains: [
      { name: 'Solana', slug: 'phantom-sol', description: 'Sign with your Phantom wallet.', handler: 'phantom-solana', chain: 'solana' },
      { name: 'Ethereum', slug: 'phantom-eth', description: 'Coming soon.' },
      { name: 'Bitcoin', slug: 'phantom-btc', description: 'Coming soon.' },
    ]
  }
];

const FN_URL = "https://yelkjimxejmrkfzeumos.supabase.co/functions/v1/verify-wallet";

// Basic check for Solana-like addresses (base58, 32-44 chars)
const isSolanaAddress = (address: string): boolean => {
  try {
    const decoded = Buffer.from(encode(address));
    return decoded.length >= 32 && decoded.length <= 44;
  } catch (e) {
    return false;
  }
};

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

  const postVerify = async (payload: object, token?: string) => {
    const r = await fetch(FN_URL, { method: "POST", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    return body;
  };

  const handleInputChange = (slug: string, value: string) => {
    setAddressInputs(prev => ({ ...prev, [slug]: value }));
  };

  const handleLink = async (chain: { slug: string; handler?: string; chain?: string }) => {
    const { slug: chainSlug, handler, chain: chainName } = chain;
    const address = addressInputs[chainSlug]?.trim();
    const isEVM = handler === 'metamask' || handler === 'walletconnect';
    const isSol = handler === 'phantom-solana';

    if (!user?.id) { toast({ variant: "destructive", title: "Please login again." }); return; }
    if (!address) { toast({ variant: "destructive", title: "Address is required" }); return; }
    if (isEVM && !isEVMAddress(address)) { toast({ variant: "destructive", title: "Invalid EVM Address" }); return; }
    if (isSol && !isSolanaAddress(address)) { toast({ variant: "destructive", title: "Invalid Solana Address" }); return; }
    if (rows.some(r => r.wallet_address?.toLowerCase() === address.toLowerCase())) { toast({ variant: "destructive", title: "Already Linked" }); return; }

    if (handler === 'metamask') await handleLinkWithMetaMask(address, chainSlug, chainName!);
    else if (handler === 'walletconnect') await handleLinkWithWalletConnect(address, chainSlug, chainName!);
    else if (handler === 'phantom-solana') await handleLinkWithPhantom(address, chainSlug);
    else toast({ title: "Coming Soon", description: "This wallet provider is not yet supported." });
  }

  const sharedLinkLogic = async (chainSlug: string, action: (token: string | undefined) => Promise<any>) => {
    setLinking(chainSlug);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      await action(token);
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

  const handleLinkWithMetaMask = async (address: string, chainSlug: string, chainName: string) => {
    await sharedLinkLogic(chainSlug, async (token) => {
      if (!(window as any).ethereum) throw new Error("MetaMask not found.");
      const [current] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (current.toLowerCase() !== address.toLowerCase()) throw new Error("Selected account differs from input address.");
      const message = await getNonce(token);
      const signature = await (window as any).ethereum.request({ method: "personal_sign", params: [toHex(message), current] });
      return postVerify({ address, signature, message, chain: chainName, walletType: 'metamask' }, token);
    });
  }
  
  const handleLinkWithWalletConnect = async (address: string, chainSlug: string, chainName: string) => {
      let provider: WCProvider | null = null;
      await sharedLinkLogic(chainSlug, async (token) => {
          provider = await createWCProvider();
          await provider.connect();
          const [current] = (await provider.request({ method: "eth_accounts" })) as string[];
          if (current.toLowerCase() !== address.toLowerCase()) throw new Error("Selected account differs from input address.");
          const message = await getNonce(token);
          const signature = (await provider.request({ method: "personal_sign", params: [toHex(message), current] })) as string;
          return postVerify({ address, signature, message, chain: chainName, walletType: 'walletconnect' }, token);
      }).finally(async () => { await provider?.disconnect?.(); });
  }

  const handleLinkWithPhantom = async (address: string, chainSlug: string) => {
    await sharedLinkLogic(chainSlug, async (token) => {
      const phantom = (window as any).phantom?.solana;
      if (!phantom) throw new Error("Phantom extension not found.");
      
      await phantom.connect();
      const publicKey = phantom.publicKey;
      if (publicKey.toString() !== address) throw new Error("Connected Phantom wallet does not match the input address.");
      
      const message = await getNonce(token);
      const encodedMessage = new TextEncoder().encode(message);
      const { signature: sigBytes } = await phantom.signMessage(encodedMessage, "utf8");
      const signature = encode(sigBytes); // bs58 encode signature

      return postVerify({ address, signature, message, chain: 'solana', walletType: 'phantom' }, token);
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
                                  placeholder={chain.chain === 'solana' ? "Solana address..." : "0x..."}
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

        {/* Linked wallets display - no changes here */}
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
