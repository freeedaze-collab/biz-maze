
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
import { Wallet, Smartphone, Globe, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { detectChainByAddress, WALLET_PROVIDERS } from '@/config/providers';
import { AdapterRegistry } from '@/lib/adapters';

const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET;
if (!FN_URL) console.warn("VITE_FUNCTION_VERIFY_WALLET is missing in .env");

type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; entity_id?: string | null; chain?: string | null; };


export default function WalletSelection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const eip6963Providers = useEIP6963();
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<boolean>(false);

  // Manual Input State
  const [manualAddress, setManualAddress] = useState("");
  const [detectedChain, setDetectedChain] = useState<{ type: string, name: string, icon: string } | null>(null);

  // Manual Signature State (for non-EVM chains)
  const [manualSignatureNonce, setManualSignatureNonce] = useState("");
  const [manualSignature, setManualSignature] = useState("");

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

    const { data: profData } = await supabase.from('profiles').select('company_name').eq('user_id', user.id).maybeSingle();
    const profCompany = profData?.company_name || "";
    setCompanyName(profCompany);

    const { data: entData } = await supabase.from('entities').select('id, name, type').eq('user_id', user.id).order('is_head_office', { ascending: false });
    if (entData) {
      setEntities(entData);
      if (!selectedEntityId && entData.length > 0) {
        setSelectedEntityId(entData[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (manualAddress) {
      const chain = detectChainByAddress(manualAddress);
      if (chain) {
        setDetectedChain({ type: chain.type, name: chain.name, icon: chain.icon });
      } else {
        setDetectedChain({ type: 'unknown', name: 'Unknown', icon: '❓' });
      }
    } else {
      setDetectedChain(null);
    }
  }, [manualAddress]);

  const getNonce = async (token: string) => {
    const r = await fetch(FN_URL, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.nonce) throw new Error(`Nonce failed. status=${r.status}, body=${JSON.stringify(body)}`);
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

  const handleUpdateWalletEntity = async (walletId: number, newEntityId: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('wallet_connections').update({ entity_id: newEntityId }).eq('id', walletId).eq('user_id', user.id);
    if (error) toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    else { toast({ title: 'Entity updated' }); await load(); }
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
  }

  // --- Handlers ---

  const linkEIP6963 = async (providerDetail: any) => {
    await sharedLinkLogic(async (token) => {
      // Use EVMWalletAdapter
      const adapter = AdapterRegistry.getWalletAdapter('metamask', providerDetail.provider);
      const connection = await adapter.connect();

      const message = await getNonce(token);
      const signature = await adapter.signMessage(message);

      return postVerify({
        address: connection.address,
        signature,
        message,
        chain: connection.chainType,
        walletType: 'metamask'
      }, token);
    });
  };

  const linkWalletConnect = async () => {
    let adapter: any = null;
    await sharedLinkLogic(async (token) => {
      if (!detectedChain || detectedChain.type !== 'evm') throw new Error("WalletConnect currently supports EVM chains.");
      if (!manualAddress) throw new Error("Enter an address first.");

      // Use WalletConnectAdapter
      adapter = AdapterRegistry.getWalletAdapter('walletconnect');
      const connection = await adapter.connect();

      if (connection.address.toLowerCase() !== manualAddress.toLowerCase()) {
        throw new Error(`Address mismatch. Expected: ${manualAddress}, Got: ${connection.address}`);
      }

      const message = await getNonce(token);
      const signature = await adapter.signMessage(message);

      return postVerify({
        address: connection.address,
        signature,
        message,
        chain: connection.chainType,
        walletType: 'walletconnect'
      }, token);
    }).finally(async () => { await adapter?.disconnect?.(); });
  };

  const linkSolanaPhantom = async () => {
    await sharedLinkLogic(async (token) => {
      // Use PhantomAdapter for Solana
      const adapter = AdapterRegistry.getWalletAdapter('phantom');
      const connection = await adapter.connect();

      if (manualAddress && connection.address !== manualAddress) {
        throw new Error(`Address mismatch. Connected: ${connection.address}`);
      }

      const message = await getNonce(token);
      const signature = await adapter.signMessage(message);

      return postVerify({
        address: connection.address,
        signature,
        message,
        chain: 'solana',
        walletType: 'phantom'
      }, token);
    });
  };

  const linkBitcoinPhantom = async () => {
    await sharedLinkLogic(async (token) => {
      // Use PhantomAdapter for Bitcoin
      const adapter = AdapterRegistry.getWalletAdapter('phantom-bitcoin');
      const connection = await adapter.connect();

      if (manualAddress && connection.address !== manualAddress) {
        throw new Error(`Address mismatch. Connected: ${connection.address}`);
      }

      const message = await getNonce(token);
      const signature = await adapter.signMessage(message);

      return postVerify({
        address: connection.address,
        signature,
        message,
        chain: 'bitcoin',
        walletType: 'bitcoin'
      }, token);
    });
  };

  // Development Bypass (No Signature)
  const linkWalletBypassDev = async () => {
    if (!manualAddress) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a wallet address" });
      return;
    }

    if (!selectedEntityId) {
      toast({ variant: "destructive", title: "Error", description: "Please select an entity" });
      return;
    }

    setLinking(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");

      const chain = detectChainByAddress(manualAddress);
      if (!chain) throw new Error("Unable to detect chain from address");

      // Bypass signature verification
      const response = await postVerify({
        address: manualAddress,
        signature: 'DEV_BYPASS',
        message: 'DEV_BYPASS',
        chain: chain.type,
        walletType: 'manual',
        entityId: selectedEntityId,
        devBypass: true
      }, token);

      if (response.success) {
        toast({ title: "✅ Success", description: "Wallet connected (dev bypass)" });
        setManualAddress("");
        setDetectedChain(null);
        await load();
      } else {
        throw new Error(response.error || "Verification failed");
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setLinking(false);
    }
  };

  // Manual Signature Handlers
  const handleGenerateNonce = async () => {
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");

      const nonce = await getNonce(token);
      setManualSignatureNonce(nonce);
      toast({ title: "Signature Request Generated", description: "Sign the message in your wallet and paste the signature below." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  };

  const handleManualSignatureVerify = async (chainType: 'bitcoin' | 'solana') => {
    if (!selectedEntityId) {
      toast({ variant: "destructive", title: "Select Owner Company", description: "Please select an entity before linking." });
      return;
    }

    setLinking(true);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (sessErr || !token) throw new Error(sessErr?.message ?? "Session error");

      await postVerify({
        address: manualAddress,
        signature: manualSignature,
        message: manualSignatureNonce,
        chain: chainType,
        walletType: chainType,
        entity_id: selectedEntityId
      }, token);

      setManualAddress("");
      setManualSignature("");
      setManualSignatureNonce("");
      await load();
      toast({ title: "Wallet Linked!", description: "Successfully verified and linked wallet." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Verification Error", description: e?.message || "Signature verification failed. Please ensure you signed the exact message shown." });
    } finally {
      setLinking(false);
    }
  };

  const handleResetManualSignature = () => {
    setManualSignatureNonce("");
    setManualSignature("");
  };

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
                <div className="text-sm text-muted-foreground mb-4">
                  We automatically detected the following browser wallets. Click to connect.
                </div>

                <div className="grid gap-3">
                  {/* EIP-6963 Providers */}
                  {eip6963Providers.length > 0 && eip6963Providers.map((provider) => (
                    <Button key={provider.info.uuid} variant="outline" className="h-14 justify-start px-4" onClick={() => linkEIP6963(provider)} disabled={linking}>
                      <img src={provider.info.icon} alt={provider.info.name} className="w-6 h-6 mr-3" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">{provider.info.name}</span>
                        <span className="text-xs text-muted-foreground">EVM Wallet</span>
                      </div>
                    </Button>
                  ))}

                  {/* 設定駆動型: 全ウォレットを自動検出・表示 */}
                  {Object.values(WALLET_PROVIDERS)
                    .filter(wallet => wallet.enabled && wallet.detection())
                    .filter(wallet => {
                      // EIP-6963ですでに検出済みのウォレットはスキップ（重複回避）
                      if (wallet.type === 'browser_extension') {
                        const isDetectedByEIP6963 = eip6963Providers.some(p =>
                          p.info.name.toLowerCase().includes(wallet.key.toLowerCase()) ||
                          wallet.name.toLowerCase().includes(p.info.name.toLowerCase())
                        );
                        if (isDetectedByEIP6963) return false;
                      }
                      return true;
                    })
                    .map(wallet => {
                      // Phantomの特別処理（Solana/Bitcoin別表示）
                      if (wallet.key === 'phantom') {
                        const buttons = [];
                        if ((window as any).phantom?.solana) {
                          buttons.push(
                            <Button key="phantom-solana" variant="outline" className="h-14 justify-start px-4" onClick={() => linkSolanaPhantom()} disabled={linking}>
                              <div className="w-6 h-6 mr-3 flex items-center justify-center bg-purple-100 rounded-full">◎</div>
                              <div className="flex flex-col items-start">
                                <span className="font-semibold">Phantom (Solana)</span>
                                <span className="text-xs text-muted-foreground">Solana Wallet</span>
                              </div>
                            </Button>
                          );
                        }
                        if ((window as any).phantom?.bitcoin) {
                          buttons.push(
                            <Button key="phantom-bitcoin" variant="outline" className="h-14 justify-start px-4" onClick={() => linkBitcoinPhantom()} disabled={linking}>
                              <div className="w-6 h-6 mr-3 flex items-center justify-center bg-orange-100 rounded-full">₿</div>
                              <div className="flex flex-col items-start">
                                <span className="font-semibold">Phantom (Bitcoin)</span>
                                <span className="text-xs text-muted-foreground">Bitcoin Wallet</span>
                              </div>
                            </Button>
                          );
                        }
                        return buttons;
                      }

                      // Bitcoin固有のウォレット (UniSat, Xverse)
                      if (wallet.key === 'unisat') {
                        return (
                          <Button key={wallet.key} variant="outline" className="h-14 justify-start px-4" onClick={() => linkBitcoinUnisat()} disabled={linking}>
                            <div className="w-6 h-6 mr-3 flex items-center justify-center bg-orange-50 rounded-full">
                              <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-semibold">{wallet.name}</span>
                              <span className="text-xs text-muted-foreground">Bitcoin Wallet</span>
                            </div>
                          </Button>
                        );
                      }

                      // Xverse (Manual for now, can be expanded later)
                      if (wallet.key === 'xverse') {
                        return (
                          <Button key={wallet.key} variant="outline" className="h-14 justify-start px-4" onClick={() => handleManualSignatureVerify('bitcoin')} disabled={linking}>
                            <div className="w-6 h-6 mr-3 flex items-center justify-center bg-orange-50 rounded-full">
                              <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-semibold">{wallet.name}</span>
                              <span className="text-xs text-muted-foreground">Bitcoin Wallet (Manual)</span>
                            </div>
                          </Button>
                        );
                      }

                      // その他のブラウザ拡張（EIP-6963非対応のレガシー含む）
                      if (wallet.type === 'browser_extension') {
                        // window[wallet.key] または window.ethereum を試行
                        const provider = (window as any)[wallet.key] || (window as any).ethereum;
                        if (provider) {
                          return (
                            <Button key={wallet.key} variant="outline" className="h-14 justify-start px-4" onClick={() => linkEIP6963({ provider, info: { name: wallet.name } })} disabled={linking}>
                              <div className="w-6 h-6 mr-3 flex items-center justify-center bg-muted rounded-full">
                                {wallet.icon ? <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" /> : <Wallet className="w-4 h-4" />}
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="font-semibold">{wallet.name}</span>
                                <span className="text-xs text-muted-foreground">Browser Wallet</span>
                              </div>
                            </Button>
                          );
                        }
                      }

                      return null;
                    })
                    .flat()
                    .filter(Boolean)}

                  {/* WalletConnect (Generic QR) */}
                  {!eip6963Providers.length && (
                    <Button variant="outline" className="h-14 justify-start px-4" onClick={linkWalletConnect} disabled={linking}>
                      <Smartphone className="w-6 h-6 mr-3 text-blue-500" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">WalletConnect</span>
                        <span className="text-xs text-muted-foreground">Scan QR with mobile app</span>
                      </div>
                    </Button>
                  )}

                  {eip6963Providers.length === 0 && !Object.values(WALLET_PROVIDERS).some(w => w.enabled && w.detection()) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No wallets detected</AlertTitle>
                      <AlertDescription>
                        Make sure you have a wallet extension installed (MetaMask, Phantom, etc.) or use Manual Input.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: MANUAL INPUT */}
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Wallet Address</label>
                  <div className="relative">
                    <Input
                      placeholder="0x... or bc1..."
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

                {/* Development Bypass Button */}
                <Alert className="bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-800">🚧 Development Mode</AlertTitle>
                  <AlertDescription className="text-orange-700">
                    Bypass signature verification for testing
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={linkWalletBypassDev}
                  disabled={!manualAddress || !detectedChain || linking}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {linking ? "Connecting..." : "🔧 Connect Without Signature (DEV)"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">OR use normal flow</span>
                  </div>
                </div>

                {detectedChain?.type === 'evm' && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-3">Sign with your browser extension or a mobile app to verify ownership.</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button className="w-full" onClick={() => linkEIP6963({ provider: (window as any).ethereum, info: { name: 'Detected Extension' } })} disabled={linking || !manualAddress}>
                        <Wallet className="w-4 h-4 mr-2" />
                        Sign with Detected Wallet
                      </Button>
                      <Button variant="outline" className="w-full" onClick={linkWalletConnect} disabled={linking || !manualAddress}>
                        <Smartphone className="w-4 h-4 mr-2" />
                        Sign with Any Other Wallet (WalletConnect)
                      </Button>
                    </div>
                  </div>
                )}

                {detectedChain?.type === 'bitcoin' && (
                  <div className="pt-2 space-y-4">
                    <p className="text-xs text-muted-foreground">Bitcoin requires manual signature verification:</p>

                    {!manualSignatureNonce ? (
                      <Button className="w-full" onClick={handleGenerateNonce} disabled={linking || !manualAddress}>
                        <Globe className="w-4 h-4 mr-2" />
                        Generate Signature Request
                      </Button>
                    ) : (
                      <>
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Step 1: Sign this message in your Bitcoin wallet</AlertTitle>
                          <AlertDescription>
                            <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all">
                              {manualSignatureNonce}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={() => navigator.clipboard.writeText(manualSignatureNonce)}
                            >
                              Copy to Clipboard
                            </Button>
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Step 2: Paste Signature</label>
                          <Input
                            placeholder="Paste signature from your wallet here..."
                            value={manualSignature}
                            onChange={(e) => setManualSignature(e.target.value)}
                            disabled={linking}
                          />
                        </div>

                        <Button className="w-full" onClick={() => handleManualSignatureVerify('bitcoin')} disabled={linking || !manualSignature}>
                          Verify & Link Wallet
                        </Button>

                        <Button variant="ghost" size="sm" className="w-full" onClick={handleResetManualSignature}>
                          Start Over
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {detectedChain?.type === 'solana' && (
                  <div className="pt-2 space-y-4">
                    <p className="text-xs text-muted-foreground">Solana requires manual signature verification:</p>

                    {!manualSignatureNonce ? (
                      <Button className="w-full" onClick={handleGenerateNonce} disabled={linking || !manualAddress}>
                        <Globe className="w-4 h-4 mr-2" />
                        Generate Signature Request
                      </Button>
                    ) : (
                      <>
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Step 1: Sign this message in your Solana wallet</AlertTitle>
                          <AlertDescription>
                            <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all">
                              {manualSignatureNonce}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={() => navigator.clipboard.writeText(manualSignatureNonce)}
                            >
                              Copy to Clipboard
                            </Button>
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Step 2: Paste Signature (base58)</label>
                          <Input
                            placeholder="Paste base58 signature from your wallet here..."
                            value={manualSignature}
                            onChange={(e) => setManualSignature(e.target.value)}
                            disabled={linking}
                          />
                        </div>

                        <Button className="w-full" onClick={() => handleManualSignatureVerify('solana')} disabled={linking || !manualSignature}>
                          Verify & Link Wallet
                        </Button>

                        <Button variant="ghost" size="sm" className="w-full" onClick={handleResetManualSignature}>
                          Start Over
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {detectedChain?.type === 'unknown' && manualAddress.length > 5 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unknown Chain</AlertTitle>
                    <AlertDescription>We couldn't detect the chain for this address. Please check the format.</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Linked Wallets List (Existing) */}
        <div className="border rounded-xl p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Linked Wallets</h3>
            {rows.length > 0 && <SyncAllWalletsButton />}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No wallets linked yet.
            </div>
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
                      {wallet.verified_at ?
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">Verified</span> :
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full whitespace-nowrap">Pending</span>
                      }
                      <button
                        onClick={() => handleDeleteWallet(wallet.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete wallet"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t mt-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Owner:</span>
                    <select
                      className="flex-1 h-7 text-xs rounded border bg-transparent px-2"
                      value={wallet.entity_id || ''}
                      onChange={(e) => handleUpdateWalletEntity(wallet.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {entities.map(ent => (
                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div >
    </AppPageLayout >
  );
}

function SyncAllWalletsButton() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncProgress('Starting sync...');

    try {
      const { syncAllWalletsIncremental } = await import('@/lib/incrementalWalletSync');

      const result = await syncAllWalletsIncremental((progress) => {
        if (progress.currentChain) {
          setSyncProgress(
            `Wallet ${progress.currentWalletIndex}/${progress.totalWallets} | ` +
            `Chain ${progress.chainIndex}/${progress.totalChains} (${progress.currentChain}) | ` +
            `${progress.transactionsSynced} txs synced`
          );
        } else {
          setSyncProgress(
            `Syncing wallet ${progress.currentWalletIndex}/${progress.totalWallets}: ${progress.walletAddress.slice(0, 10)}... (${progress.transactionsSynced} total txs)`
          );
        }
      });

      if (result.success) {
        toast({
          title: 'Wallet Sync Complete',
          description: `✅ Successfully synced ${result.totalSynced} transactions across all wallets!`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Completed with Errors',
          description: `${result.totalSynced} transactions synced, but ${result.errors.length} wallet(s) failed.`,
        });
      }
    } catch (error) {
      console.error('Sync all error:', error);
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleSyncAll}
        disabled={isSyncing}
        size="sm"
        variant="outline"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync All'}
      </Button>
      {syncProgress && (
        <p className="text-xs text-muted-foreground">{syncProgress}</p>
      )}
    </div>
  );
}
