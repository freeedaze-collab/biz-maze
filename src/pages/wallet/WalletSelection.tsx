// src/pages/wallet/WalletSelection.tsx
// ETH only: MetaMask connect (wagmi) + save to wallet_connections (multiple allowed)

import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";

type WalletRow = {
  id: string;
  user_id: string;
  provider: string; // "metamask" | "manual"
  address: string;
  created_at?: string;
};

export default function WalletSelection() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectErr, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const [list, setList] = useState<WalletRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallet_connections").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList(data || []);
  };

  useEffect(() => { load(); }, [user?.id]);

  const saveWallet = async (provider: string, addr: string) => {
    if (!user || !addr) return;
    setSaving(true);
    await supabase.from("wallet_connections").insert({ user_id: user.id, provider, address: addr });
    setSaving(false);
    setManualAddress("");
    await load();
  };

  const connectMetamask = async () => {
    try {
      const injected = connectors.find(c => c.id === "injected") || new InjectedConnector();
      await connect({ connector: injected });
      // wagmi が address を更新した後に保存（次のレンダリングで address が入る）
      setTimeout(async () => {
        if (address) await saveWallet("metamask", address);
      }, 200);
    } catch (e) {
      console.error("metamask connect error", e);
    }
  };

  const linkManual = async () => {
    if (!manualAddress) return;
    await saveWallet("manual", manualAddress);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Connect Wallet (ETH)</CardTitle>
              <CardDescription>Connect MetaMask or link an address manually. Multiple wallets are supported.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={connectMetamask} disabled={isPending}>
                  {isConnected ? "Re-connect MetaMask" : "Connect MetaMask"}
                </Button>
                <Button variant="outline" onClick={() => disconnect()} disabled={!isConnected}>
                  Disconnect
                </Button>
              </div>
              {connectErr && <p className="text-destructive text-sm">{String(connectErr?.message || connectErr)}</p>}

              <div className="rounded-md border p-3 space-y-2">
                <Label>Link address manually</Label>
                <div className="flex gap-2">
                  <Input placeholder="0x..." value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} />
                  <Button onClick={linkManual} disabled={saving || !manualAddress}>Link</Button>
                </div>
                <p className="text-xs text-muted-foreground">This will simply store the address for future transfers.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked Wallets</CardTitle>
              <CardDescription>Saved addresses for transfers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
              ) : (
                list.map((w) => (
                  <div key={w.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium">{w.provider}</div>
                      <div className="font-mono text-xs opacity-80">{w.address}</div>
                    </div>
                    {/* 将来: 削除や既定設定 */}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
