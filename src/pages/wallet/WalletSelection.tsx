// @ts-nocheck
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { encode, decode } from "@/lib/bs58";
import { useEIP6963 } from "@/hooks/useEIP6963";
import { Wallet, Smartphone, Globe, AlertCircle, HardDrive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET;
if (!FN_URL) console.warn("VITE_FUNCTION_VERIFY_WALLET is missing in .env");

type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; entity_id?: string | null; chain?: string | null; };

const detectChain = (address: string) => {
  if (isEVMAddress(address)) return { type: 'evm', name: 'EVM Chain', icon: '🌐' };
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address)) return { type: 'bitcoin', name: 'Bitcoin', icon: '₿' };
  try {
    const decoded = decode(address);
    if (decoded.length === 32) return { type: 'solana', name: 'Solana', icon: '◎' };
  } catch { }
  return { type: 'unknown', name: 'Unknown', icon: '❓' };
};

export default function WalletSelection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const eip6963Providers = useEIP6963();
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<boolean>(false);
  const [manualAddress, setManualAddress] = useState("");
  const [detectedChain, setDetectedChain] = useState<{ type: string, name: string, icon: string } | null>(null);
  const [manualSignatureNonce, setManualSignatureNonce] = useState("");
  const [manualSignature, setManualSignature] = useState("");
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
    const { data: profData } = await supabase.from('profiles').select('company_name').eq('user_id', user.id).maybeSingle();
    setCompanyName(profData?.company_name || "");
    const { data: entData } = await supabase.from('entities').select('id, name, type').eq('user_id', user.id).order('is_head_office', { ascending: false });
    if (entData) {
      setEntities(entData);
      if (!selectedEntityId && entData.length > 0) setSelectedEntityId(entData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);
  useEffect(() => {
    if (manualAddress) setDetectedChain(detectChain(manualAddress));
    else setDetectedChain(null);
  }, [manualAddress]);

  const getNonce = async (token: string) => {
    const r = await fetch(FN_URL, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) throw new Error(`Nonce failed. status=${r.status}`);
    return body.nonce as string;
  };

  const postVerify = async (payload: object, token: string) => {
    const finalPayload = { ...payload, entity_id: selectedEntityId };
    const r = await fetch(FN_URL, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(finalPayload) });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!r.ok || !body?.ok) throw new Error(`Verify failed. status=${r.status}, body=${text}`);
    return body;
  };

  const handleDeleteWallet = async (walletId: number) => {
    if (!user?.id) return;
    if (!confirm('Are you sure you want to delete this wallet connection?')) return;
    const { error } = await supabase.from('wallet_connections').delete().eq('id', walletId).eq('user_id', user.id);
    if (error) toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    else { toast({ title: 'Wallet deleted' }); await load(); }
  };

  const sharedLinkLogic = async (action: (token: string) => Promise<any>) => {
    if (!selectedEntityId) { toast({ variant: "destructive", title: "Select Owner Company", description: "Please select an entity before linking." }); return; }
    setLinking(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");
      await action(token);
      setManualAddress("");
      await load();
      toast({ title: "Wallet Linked!", description: "Successfully verified and linked wallet." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Linking Error", description: e?.message });
    } finally {
      setLinking(false);
    }
  };

  // ── EVM ──────────────────────────────────────────────────────
  const linkEIP6963 = async (providerDetail: any) => {
    await sharedLinkLogic(async (token) => {
      const provider = providerDetail.provider;
      const [current] = await provider.request({ method: "eth_requestAccounts" });
      if (!current) throw new Error("No account selected.");
      const message = await getNonce(token);
      const signature = await provider.request({ method: "personal_sign", params: [toHex(message), current] });
      return postVerify({ address: current, signature, message, chain: 'ethereum', walletType: 'metamask' }, token);
    });
  };

  const linkWalletConnect = async () => {
    let provider: WCProvider | null = null;
    await sharedLinkLogic(async (token) => {
      if (!detectedChain || detectedChain.type !== 'evm') throw new Error("WalletConnect currently supports EVM chains.");
      if (!manualAddress) throw new Error("Enter an address first.");
      provider = await createWCProvider();
      await provider.connect();
      const [current] = (await provider.request({ method: "eth_accounts" })) as string[];
      if (!current || current.toLowerCase() !== manualAddress.toLowerCase()) throw new Error(`Address mismatch. Expected: ${manualAddress}, Got: ${current}`);
      const message = await getNonce(token);
      const signature = (await provider.request({ method: "personal_sign", params: [toHex(message), current] })) as string;
      return postVerify({ address: manualAddress, signature, message, chain: 'ethereum', walletType: 'walletconnect' }, token);
    }).finally(async () => { await provider?.disconnect?.(); });
  };

  // ── Solana ───────────────────────────────────────────────────
  const linkSolanaWallet = async (walletName: string, getProvider: () => any) => {
    await sharedLinkLogic(async (token) => {
      const wallet = getProvider();
      if (!wallet) throw new Error(`${walletName} not found.`);
      await wallet.connect();
      const publicKey = wallet.publicKey?.toString();
      if (!publicKey) throw new Error("Could not get public key.");
      if (manualAddress && publicKey !== manualAddress) throw new Error(`Address mismatch. Connected: ${publicKey}`);
      const message = await getNonce(token);
      const encodedMessage = new TextEncoder().encode(message);
      const { signature: sigBytes } = await wallet.signMessage(encodedMessage, "utf8");
      const signature = encode(sigBytes);
      return postVerify({ address: publicKey, signature, message, chain: 'solana', walletType: walletName.toLowerCase() }, token);
    });
  };

  // ── Bitcoin ──────────────────────────────────────────────────
  const linkBitcoinPhantom = async () => {
    await sharedLinkLogic(async (token) => {
      const provider = (window as any).phantom?.bitcoin;
      if (!provider?.isPhantom) throw new Error("Phantom Bitcoin not found.");
      const accounts = await provider.requestAccounts();
      const account = manualAddress ? accounts.find((a: any) => a.address === manualAddress) : accounts[0];
      if (!account) throw new Error("Account not found.");
      const message = await getNonce(token);
      const messageBytes = new TextEncoder().encode(message);
      const signatureResult = await provider.signMessage(account.address, messageBytes);
      const signatureBytes = signatureResult.signature || signatureResult;
      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
      return postVerify({ address: account.address, signature: signatureBase64, message, chain: 'bitcoin', walletType: 'bitcoin' }, token);
    });
  };

  const linkUniSat = async () => {
    await sharedLinkLogic(async (token) => {
      const unisat = (window as any).unisat;
      if (!unisat) throw new Error("UniSat not found.");
      const accounts = await unisat.requestAccounts();
      const address = accounts[0];
      if (!address) throw new Error("No account selected.");
      if (manualAddress && address !== manualAddress) throw new Error(`Address mismatch. Connected: ${address}`);
      const message = await getNonce(token);
      const signature = await unisat.signMessage(message);
      return postVerify({ address, signature, message, chain: 'bitcoin', walletType: 'bitcoin' }, token);
    });
  };

  const linkXverse = async () => {
    await sharedLinkLogic(async (token) => {
      const xverse = (window as any).XverseProviders?.BitcoinProvider;
      if (!xverse) throw new Error("Xverse not found.");
      // Xverse uses getAddresses then signMessage
      const addressResponse = await xverse.request("getAddresses", { purposes: ["payment", "ordinals"] });
      const address = manualAddress
        ? addressResponse.result.addresses.find((a: any) => a.address === manualAddress)?.address
        : addressResponse.result.addresses[0]?.address;
      if (!address) throw new Error("No address found.");
      const message = await getNonce(token);
      const signResponse = await xverse.request("signMessage", { address, message });
      const signature = signResponse.result.signature;
      return postVerify({ address, signature, message, chain: 'bitcoin', walletType: 'bitcoin' }, token);
    });
  };

  // ── Manual Signature ─────────────────────────────────────────
  const handleGenerateNonce = async () => {
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");
      const nonce = await getNonce(token);
      setManualSignatureNonce(nonce);
      toast({ title: "Signature Request Generated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  };

  const handleManualSignatureVerify = async (chainType: 'bitcoin' | 'solana') => {
    if (!selectedEntityId) { toast({ variant: "destructive", title: "Select Owner Company" }); return; }
    setLinking(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");
      await postVerify({ address: manualAddress, signature: manualSignature, message: manualSignatureNonce, chain: chainType, walletType: chainType }, token);
      setManualAddress(""); setManualSignature(""); setManualSignatureNonce("");
      await load();
      toast({ title: "Wallet Linked!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Verification Error", description: e?.message });
    } finally { setLinking(false); }
  };

  const handleResetManualSignature = () => { setManualSignatureNonce(""); setManualSignature(""); };

  // 検出されたウォレット一覧を構築
  const detectedNonEVMWallets = [
    // Solana
    { key: 'phantom-sol', label: 'Phantom (Solana)', sub: 'Solana', icon: '◎', bg: 'bg-purple-100', show: !!(window as any).phantom?.solana, action: () => linkSolanaWallet('phantom', () => (window as any).phantom?.solana) },
    { key: 'solflare', label: 'Solflare', sub: 'Solana', icon: '☀️', bg: 'bg-yellow-100', show: !!(window as any).solflare?.isSolflare, action: () => linkSolanaWallet('solflare', () => (window as any).solflare) },
    { key: 'backpack', label: 'Backpack', sub: 'Solana', icon: '🎒', bg: 'bg-blue-100', show: !!(window as any).backpack?.solana, action: () => linkSolanaWallet('backpack', () => (window as any).backpack?.solana) },
    // Bitcoin
    { key: 'phantom-btc', label: 'Phantom (Bitcoin)', sub: 'Bitcoin', icon: '₿', bg: 'bg-orange-100', show: !!(window as any).phantom?.bitcoin, action: linkBitcoinPhantom },
    { key: 'unisat', label: 'UniSat', sub: 'Bitcoin', icon: '🟠', bg: 'bg-orange-100', show: !!(window as any).unisat, action: linkUniSat },
    { key: 'xverse', label: 'Xverse', sub: 'Bitcoin', icon: '✕', bg: 'bg-gray-100', show: !!(window as any).XverseProviders?.BitcoinProvider, action: linkXverse },
  ].filter(w => w.show);

  const hasAnyWallet = eip6963Providers.length > 0 || detectedNonEVMWallets.length > 0;

  return (
    <AppPageLayout title="Link Wallets" description="Connect your wallets to sync transactions.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Connect New Wallet</CardTitle>
            <CardDescription>Select a method to link your wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Entity Selector */}
            <div className="mb-6">
              <label className="text-xs font-medium mb-1.5 block">Owner Company <span className="text-red-500">*</span></label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                <option value="" disabled>Select Owner Company</option>
                {entities.map(e => (
                  <option key={e.id} value={e.id}>{e.type === 'personal' && companyName ? `${companyName} (${e.name})` : e.name}</option>
                ))}
              </select>
            </div>

            <Tabs defaultValue="detected" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="detected">Detected Wallets</TabsTrigger>
                <TabsTrigger value="manual">Manual Input</TabsTrigger>
              </TabsList>

              {/* TAB 1: DETECTED WALLETS */}
              <TabsContent value="detected" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-2">Browser wallets detected automatically. Click to connect.</div>

                {!hasAnyWallet && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No wallets detected</AlertTitle>
                    <AlertDescription>Install MetaMask, Phantom, UniSat, Solflare, or another wallet extension, then refresh.</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3">
                  {/* EVM: EIP-6963 */}
                  {eip6963Providers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">EVM Wallets</p>
                      {eip6963Providers.map((provider) => (
                        <Button key={provider.info.uuid} variant="outline" className="h-14 w-full justify-start px-4" onClick={() => linkEIP6963(provider)} disabled={linking}>
                          <img src={provider.info.icon} alt={provider.info.name} className="w-6 h-6 mr-3" />
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{provider.info.name}</span>
                            <span className="text-xs text-muted-foreground">Ethereum / EVM</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Solana & Bitcoin */}
                  {detectedNonEVMWallets.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">Other Chains</p>
                      {detectedNonEVMWallets.map((w) => (
                        <Button key={w.key} variant="outline" className="h-14 w-full justify-start px-4" onClick={w.action} disabled={linking}>
                          <div className={`w-6 h-6 mr-3 flex items-center justify-center ${w.bg} rounded-full text-sm`}>{w.icon}</div>
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{w.label}</span>
                            <span className="text-xs text-muted-foreground">{w.sub}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Ledger / Trezor via WalletConnect */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">Hardware Wallets</p>
                    <Button variant="outline" className="h-14 w-full justify-start px-4" onClick={linkWalletConnect} disabled={linking || !manualAddress}>
                      <div className="w-6 h-6 mr-3 flex items-center justify-center bg-gray-100 rounded-full">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Ledger / Trezor (QR Code)</span>
                        <span className="text-xs text-muted-foreground">Enter address in Manual Input first, then scan QR</span>
                      </div>
                    </Button>
                    {!manualAddress && (
                      <p className="text-xs text-amber-600">※ Hardware wallet: enter your address in the Manual Input tab first.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: MANUAL INPUT */}
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Wallet Address</label>
                  <div className="relative">
                    <Input
                      placeholder="0x... or bc1... or Solana address"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      disabled={linking}
                    />
                    {detectedChain && (
                      <div className="absolute right-3 top-2.5 flex items-center text-xs text-muted-foreground">
                        <span className="mr-1">{detectedChain.icon}</span> {detectedChain.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* EVM */}
                {detectedChain?.type === 'evm' && (
                  <div className="pt-2 space-y-3">
                    <p className="text-xs text-muted-foreground">Choose signing method:</p>
                    <div className="grid grid-cols-1 gap-2">
                      {(window as any).ethereum && (
                        <Button className="w-full" onClick={() => linkEIP6963({ provider: (window as any).ethereum, info: { name: 'Browser Extension' } })} disabled={linking || !manualAddress}>
                          <Wallet className="w-4 h-4 mr-2" />
                          {eip6963Providers.length > 0 ? `Sign with ${eip6963Providers[0].info.name}` : 'Sign with Browser Wallet'}
                        </Button>
                      )}
                      <Button variant={(window as any).ethereum ? "outline" : "default"} className="w-full" onClick={linkWalletConnect} disabled={linking || !manualAddress}>
                        <Smartphone className="w-4 h-4 mr-2" />
                        Sign with Any Wallet / Ledger / Trezor (QR)
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Hardware wallets (Ledger/Trezor) and mobile wallets can connect via QR code.
                    </p>
                  </div>
                )}

                {/* Bitcoin */}
                {detectedChain?.type === 'bitcoin' && (
                  <div className="pt-2 space-y-4">
                    <p className="text-xs text-muted-foreground font-medium">Detected: Bitcoin address</p>

                    {/* Browser wallets */}
                    <div className="grid gap-2">
                      {(window as any).unisat && (
                        <Button className="w-full" onClick={linkUniSat} disabled={linking}>
                          <span className="mr-2">🟠</span> Sign with UniSat
                        </Button>
                      )}
                      {(window as any).XverseProviders?.BitcoinProvider && (
                        <Button variant="outline" className="w-full" onClick={linkXverse} disabled={linking}>
                          <span className="mr-2">✕</span> Sign with Xverse
                        </Button>
                      )}
                      {(window as any).phantom?.bitcoin && (
                        <Button variant="outline" className="w-full" onClick={linkBitcoinPhantom} disabled={linking}>
                          <span className="mr-2">₿</span> Sign with Phantom (Bitcoin)
                        </Button>
                      )}
                    </div>

                    {/* Manual signature fallback */}
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2">No extension? Sign manually with any Bitcoin wallet:</p>
                      {!manualSignatureNonce ? (
                        <Button variant="outline" className="w-full" onClick={handleGenerateNonce} disabled={linking}>
                          <Globe className="w-4 h-4 mr-2" /> Generate Signature Request
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Step 1: Sign this message</AlertTitle>
                            <AlertDescription>
                              <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all">{manualSignatureNonce}</div>
                              <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(manualSignatureNonce)}>Copy</Button>
                            </AlertDescription>
                          </Alert>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Step 2: Paste Signature</label>
                            <Input placeholder="Paste signature..." value={manualSignature} onChange={(e) => setManualSignature(e.target.value)} disabled={linking} />
                          </div>
                          <Button className="w-full" onClick={() => handleManualSignatureVerify('bitcoin')} disabled={linking || !manualSignature}>Verify & Link</Button>
                          <Button variant="ghost" size="sm" className="w-full" onClick={handleResetManualSignature}>Start Over</Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Solana */}
                {detectedChain?.type === 'solana' && (
                  <div className="pt-2 space-y-4">
                    <p className="text-xs text-muted-foreground font-medium">Detected: Solana address</p>

                    {/* Browser wallets */}
                    <div className="grid gap-2">
                      {(window as any).phantom?.solana && (
                        <Button className="w-full" onClick={() => linkSolanaWallet('phantom', () => (window as any).phantom?.solana)} disabled={linking}>
                          <span className="mr-2">◎</span> Sign with Phantom
                        </Button>
                      )}
                      {(window as any).solflare?.isSolflare && (
                        <Button variant="outline" className="w-full" onClick={() => linkSolanaWallet('solflare', () => (window as any).solflare)} disabled={linking}>
                          <span className="mr-2">☀️</span> Sign with Solflare
                        </Button>
                      )}
                      {(window as any).backpack?.solana && (
                        <Button variant="outline" className="w-full" onClick={() => linkSolanaWallet('backpack', () => (window as any).backpack?.solana)} disabled={linking}>
                          <span className="mr-2">🎒</span> Sign with Backpack
                        </Button>
                      )}
                    </div>

                    {/* Manual signature fallback */}
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2">No extension? Sign manually:</p>
                      {!manualSignatureNonce ? (
                        <Button variant="outline" className="w-full" onClick={handleGenerateNonce} disabled={linking}>
                          <Globe className="w-4 h-4 mr-2" /> Generate Signature Request
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Step 1: Sign this message</AlertTitle>
                            <AlertDescription>
                              <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all">{manualSignatureNonce}</div>
                              <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(manualSignatureNonce)}>Copy</Button>
                            </AlertDescription>
                          </Alert>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Step 2: Paste Signature (base58)</label>
                            <Input placeholder="Paste base58 signature..." value={manualSignature} onChange={(e) => setManualSignature(e.target.value)} disabled={linking} />
                          </div>
                          <Button className="w-full" onClick={() => handleManualSignatureVerify('solana')} disabled={linking || !manualSignature}>Verify & Link</Button>
                          <Button variant="ghost" size="sm" className="w-full" onClick={handleResetManualSignature}>Start Over</Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detectedChain?.type === 'unknown' && manualAddress.length > 5 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unknown Chain</AlertTitle>
                    <AlertDescription>Could not detect chain for this address. Please check the format.</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Linked Wallets List */}
        <div className="border rounded-xl p-6 bg-card">
          <h3 className="font-semibold mb-4 text-lg">Linked Wallets</h3>
          {loading ? (
            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">No wallets linked yet.</div>
          ) : (
            <div className="space-y-4">
              {rows.map((wallet) => (
                <div key={wallet.id} className="p-4 rounded-lg border bg-background/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {wallet.chain === 'bitcoin' ? '₿' : wallet.chain === 'solana' ? '◎' : 'Ξ'}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-mono text-sm truncate w-full">{wallet.wallet_address}</span>
                        <span className="text-xs text-muted-foreground capitalize">{wallet.chain || 'Unknown Chain'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {wallet.verified_at ? <Badge variant="secondary" className="text-xs">Verified</Badge> : <Badge variant="outline" className="text-xs">Unverified</Badge>}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteWallet(wallet.id)}>✕</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppPageLayout>
  );
}
