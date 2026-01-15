
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
import { encode, decode } from "@/lib/bs58";
import { useEIP6963 } from "@/hooks/useEIP6963";

// ... (inside component)


type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; entity_id?: string | null; chain?: string | null; };

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
    ]
  },
  {
    name: 'Phantom',
    slug: 'phantom',
    chains: [
      { name: 'Solana', slug: 'phantom-sol', description: 'Sign with your Phantom wallet.', handler: 'phantom-solana', chain: 'solana' },
      { name: 'Ethereum', slug: 'phantom-eth', description: 'Sign with your Phantom EVM wallet.', handler: 'phantom-evm', chain: 'ethereum' },
      { name: 'Polygon', slug: 'phantom-polygon', description: 'Sign with your Phantom EVM wallet.', handler: 'phantom-evm', chain: 'polygon' },
      { name: 'Base', slug: 'phantom-base', description: 'Sign with your Phantom EVM wallet.', handler: 'phantom-evm', chain: 'base' },
      { name: 'Bitcoin', slug: 'phantom-btc', description: 'Sign with your Phantom Bitcoin wallet.', handler: 'phantom-btc', chain: 'bitcoin' },
    ]
  }
];

const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET;
if (!FN_URL) console.warn("VITE_FUNCTION_VERIFY_WALLET is missing in .env");

// Basic check for Solana-like addresses (base58)
const isSolanaAddress = (address: string): boolean => {
  try {
    const decoded = decode(address);
    return decoded.length === 32;
  } catch (e) {
    return false;
  }
};

export default function WalletSelection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const eip6963Providers = useEIP6963();
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [addressInputs, setAddressInputs] = useState<{ [key: string]: string }>({});

  // Entity Selection
  const [entities, setEntities] = useState<{ id: string, name: string, type: string }[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("wallet_connections").select("id,user_id,wallet_address,verified_at,entity_id,chain").eq("user_id", user.id).order("verified_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Error loading wallets", description: error.message });
    } else {
      setRows((data as WalletRow[]) ?? []);
    }

    // Fetch Profile Company Name
    const { data: profData } = await supabase.from('profiles').select('company_name').eq('user_id', user.id).maybeSingle();
    const profCompany = profData?.company_name || "";
    setCompanyName(profCompany);

    // Fetch Entities
    const { data: entData } = await supabase.from('entities').select('id, name, type').eq('user_id', user.id).order('is_head_office', { ascending: false });
    if (entData) {
      setEntities(entData);
      // Default to Head Office or first entity if not set
      if (!selectedEntityId && entData.length > 0) {
        setSelectedEntityId(entData[0].id);
      }
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const getNonce = async (token: string) => {
    const r = await fetch(FN_URL, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) throw new Error(`Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`);
    return body.nonce as string;
  };

  const postVerify = async (payload: object, token: string) => {
    // Inject entity_id
    const finalPayload = { ...payload, entity_id: selectedEntityId };
    const r = await fetch(FN_URL, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(finalPayload) });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    return body;
  };

  const handleInputChange = (slug: string, value: string) => {
    setAddressInputs(prev => ({ ...prev, [slug]: value }));
  };

  // Update entity for an existing wallet connection
  const handleUpdateWalletEntity = async (walletId: number, newEntityId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('wallet_connections')
      .update({ entity_id: newEntityId })
      .eq('id', walletId)
      .eq('user_id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    } else {
      toast({ title: 'Entity updated', description: 'Wallet entity has been updated.' });
      await load(); // Refresh the list
    }
  };

  const handleLink = async (chain: { slug: string; handler?: string; chain?: string }) => {
    console.log("[Wallet] handleLink clicked", chain);
    const { slug: chainSlug, handler, chain: chainName } = chain;
    const address = addressInputs[chainSlug]?.trim();
    const isEVM = handler === 'metamask' || handler === 'walletconnect';
    const isSol = handler === 'phantom-solana';

    console.log(`[Wallet] Inputs - Address: ${address}, Handler: ${handler}, isEVM: ${isEVM}, isSol: ${isSol}`);

    if (!user?.id) { console.log("[Wallet] No user ID"); toast({ variant: "destructive", title: "Please login again." }); return; }
    if (!address) { console.log("[Wallet] No address"); toast({ variant: "destructive", title: "Address is required" }); return; }

    if (isEVM && !isEVMAddress(address)) {
      if (address.toLowerCase().startsWith('bc1')) {
        toast({ variant: "destructive", title: "Invalid Chain Selection", description: "You entered a Bitcoin address but selected an EVM chain. Please select 'Bitcoin' from the list." });
        return;
      }
      console.log("[Wallet] Invalid EVM address");
      toast({ variant: "destructive", title: "Invalid EVM Address" }); return;
    }
    if (isSol) {
      const validSol = isSolanaAddress(address);
      console.log(`[Wallet] checking solana address: ${validSol}`);
      if (!validSol) {
        console.log("[Wallet] Invalid Solana address");
        toast({ variant: "destructive", title: "Invalid Solana Address" }); return;
      }
    }

    if (rows.some(r => r.wallet_address?.toLowerCase() === address.toLowerCase())) {
      console.log("[Wallet] Already linked");
      toast({ variant: "destructive", title: "Already Linked" }); return;
    }
    if (!selectedEntityId) {
      console.log("[Wallet] No entity selected");
      toast({ variant: "destructive", title: "Please select an entity." }); return;
    }

    console.log(`[Wallet] Validation passed. Dispatching handler for ${handler}`);

    if (handler === 'metamask') await handleLinkWithMetaMask(address, chainSlug, chainName!);
    else if (handler === 'walletconnect') await handleLinkWithWalletConnect(address, chainSlug, chainName!);
    else if (handler === 'phantom-evm') await handleLinkWithPhantomEVM(address, chainSlug, chainName!);
    else if (handler === 'phantom-btc') await handleLinkWithPhantomBitcoin(address, chainSlug);
    else if (handler === 'phantom-solana') await handleLinkWithPhantom(address, chainSlug);
    else toast({ title: "Coming Soon", description: "This wallet provider is not yet supported." });
  }

  // ... (Keep sharedLinkLogic and handlers same, they use postVerify which now injects entity_id)

  const sharedLinkLogic = async (chainSlug: string, action: (token: string) => Promise<any>) => {
    console.log(`[Wallet] Starting link logic for ${chainSlug}`);
    setLinking(chainSlug);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Couldn't get session");
      console.log(`[Wallet] Got session, executing action...`);
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
      // Find MetaMask provider via EIP-6963
      const metaMaskProvider = eip6963Providers.find(p => p.info.name === "MetaMask")?.provider;

      // Fallback to window.ethereum if identifying precise provider fails (but prefer precise one)
      const providerToUse = metaMaskProvider || (window as any).ethereum;

      if (!providerToUse) throw new Error("MetaMask not found.");

      const [current] = await providerToUse.request({ method: "eth_requestAccounts" });

      if (current.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`Address Mismatch:\nInput: ${address.slice(0, 6)}...${address.slice(-4)}\nConnected: ${current.slice(0, 6)}...${current.slice(-4)}\n\nPlease ensure you are connected to the correct account in the correct wallet.`);
      }

      const message = await getNonce(token);
      const signature = await providerToUse.request({ method: "personal_sign", params: [toHex(message), current] });
      return postVerify({ address, signature: signature, message, chain: chainName, walletType: 'metamask' }, token);
    });
  }

  const handleLinkWithPhantomEVM = async (address: string, chainSlug: string, chainName: string) => {
    await sharedLinkLogic(chainSlug, async (token) => {
      // Find Phantom provider via EIP-6963
      const phantomProvider = eip6963Providers.find(p => p.info.name === "Phantom")?.provider;
      // Fallback to window.phantom?.ethereum if available
      const providerToUse = phantomProvider || (window as any).phantom?.ethereum;

      if (!providerToUse) throw new Error("Phantom EVM provider not found.");

      const [current] = await providerToUse.request({ method: "eth_requestAccounts" });

      if (current.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`Address Mismatch:\nInput: ${address.slice(0, 6)}...${address.slice(-4)}\nConnected: ${current.slice(0, 6)}...${current.slice(-4)}\n\nPlease ensure you are connected to the correct account in Phantom.`);
      }

      const message = await getNonce(token);
      const signature = await providerToUse.request({ method: "personal_sign", params: [toHex(message), current] });
      // Note: using 'metamask' as walletType for backend because checking logic is same for EVM
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


  const handleLinkWithPhantomBitcoin = async (address: string, chainSlug: string) => {
    await sharedLinkLogic(chainSlug, async (token) => {
      const provider = (window as any).phantom?.bitcoin;
      if (!provider || !provider.isPhantom) throw new Error("Phantom Bitcoin provider not found.");

      // Phantom Bitcoin API uses connect() to get accounts
      const accounts = await provider.requestAccounts();
      // Accounts: [{ address, addressType, publicKey, purpose }]
      const account = accounts.find((acc: any) => acc.address === address);

      if (!account) {
        const first = accounts[0]?.address;
        throw new Error(`Address Mismatch:\nInput: ${address}\nConnected: ${first}\n\nPlease select the correct account in Phantom.`);
      }

      const message = await getNonce(token);
      const messageBytes = new TextEncoder().encode(message);
      const signatureResult = await provider.signMessage(address, messageBytes);
      // Based on logs, Phantom returns a 66-byte array where the first byte is likely an internal prefix (checking source/logs suggest 0x01).
      // We will send the RAW signature to the backend and handle the format correction there.
      // This is more robust as we can try recovering with different headers on the server side.
      const signatureBytes = signatureResult.signature || signatureResult;

      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

      return postVerify({ address, signature: signatureBase64, message, chain: 'bitcoin', walletType: 'bitcoin' }, token);
    });
  }

  const handleLinkWithPhantom = async (address: string, chainSlug: string) => {
    console.log(`[Wallet] handleLinkWithPhantom triggered. Address: ${address}`);
    await sharedLinkLogic(chainSlug, async (token) => {
      const phantom = (window as any).phantom?.solana;
      console.log(`[Wallet] Phantom object:`, phantom);
      if (!phantom) throw new Error("Phantom extension not found.");

      console.log(`[Wallet] Connecting to Phantom...`);
      await phantom.connect();
      const publicKey = phantom.publicKey.toString();
      console.log(`[Wallet] Phantom connected. PubKey: ${publicKey}`);

      if (publicKey !== address) throw new Error(`Connected Phantom wallet (${publicKey}) does not match the input address (${address}).`);

      console.log(`[Wallet] Requesting nonce...`);
      const message = await getNonce(token);
      console.log(`[Wallet] Got nonce: ${message}`);

      const encodedMessage = new TextEncoder().encode(message);
      const { signature: sigBytes } = await phantom.signMessage(encodedMessage, "utf8");
      const signature = encode(sigBytes); // bs58 encode signature
      console.log(`[Wallet] Signed. Signature: ${signature}`);

      return postVerify({ address, signature, message, chain: 'solana', walletType: 'phantom' }, token);
    });
  }

  return (
    <AppPageLayout title="Wallets (Updated)" description="Link wallets to your account, verify ownership, and keep your ledger in sync.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Add a wallet</CardTitle>
            <CardDescription>Choose a provider, select a network, enter your address, and sign.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Entity Selector */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-1 block">Owner Company <span className="text-red-500">*</span></label>
              <select
                className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer ${!selectedEntityId ? 'border-red-300 ring-1 ring-red-100' : 'border-input'}`}
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                <option value="" disabled>Select Owner Company</option>
                {entities.map(e => {
                  const displayName = (e.type === 'personal' && companyName)
                    ? `${companyName} (${e.name})`
                    : e.name;
                  return <option key={e.id} value={e.id}>{displayName}</option>
                })}
              </select>
              {!selectedEntityId && <p className="text-[10px] text-red-500 mt-1">Owner Company is required to link a wallet.</p>}
            </div>

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

        {/* Linked wallets display */}
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
            <div className="space-y-3">
              {Object.values(rows.reduce((acc: any, row) => {
                const key = row.wallet_address;
                if (!acc[key]) acc[key] = { ...row };
                return acc;
              }, {})).map((wallet: any) => {
                const entityName = entities.find(e => e.id === wallet.entity_id)?.name || 'Not assigned';
                return (
                  <div key={wallet.id} className="border rounded-xl p-4 bg-white/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-mono break-all text-sm font-medium">{wallet.wallet_address}</div>
                      <div className="flex items-center gap-2">
                        {wallet.chain && <span className="text-xs text-muted-foreground bg-blue-50 px-2 py-0.5 rounded">{wallet.chain}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded ${wallet.verified_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {wallet.verified_at ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <label className="text-xs text-muted-foreground">Entity:</label>
                      <select
                        className="flex-1 h-8 text-xs rounded-md border bg-transparent px-2 cursor-pointer"
                        value={wallet.entity_id || ''}
                        onChange={(e) => handleUpdateWalletEntity(wallet.id, e.target.value)}
                      >
                        <option value="">Not assigned</option>
                        {companyName && <option value="owner">{companyName} (Owner)</option>}
                        {entities.map(ent => (
                          <option key={ent.id} value={ent.id}>{ent.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppPageLayout>
  );
}
