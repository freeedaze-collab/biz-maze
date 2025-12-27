
// src/pages/wallet/WalletSelection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress as isEVMAddress } from "viem";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

type WalletRow = { id: number; user_id: string; wallet_address: string; verified_at?: string | null; };

export default function WalletSelection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [address, setAddress] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("wallet_connections").select("id,user_id,wallet_address,verified_at").eq("user_id", user.id);
    if (error) {
      toast({ variant: "destructive", title: "Error loading wallets", description: error.message });
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleLink = async () => {
    if (!user?.id) { toast({ variant: "destructive", title: "Please login again." }); return; }
    if (!address.trim()) { toast({ variant: "destructive", title: "Address is required" }); return; }
    if (!isEVMAddress(address.trim())) { toast({ variant: "destructive", title: "Invalid EVM Address" }); return; }
    if (rows.some(r => r.wallet_address?.toLowerCase() === address.trim().toLowerCase())) { toast({ variant: "destructive", title: "Already Linked" }); return; }

    setLinking(true);
    try {
      const { error } = await supabase.from("wallet_connections").insert({ user_id: user.id, wallet_address: address.trim() });
      if (error) throw error;
      setAddress("");
      await load();
      toast({ title: "Wallet Linked!", description: "Successfully linked wallet." });
    } catch (e: any) {
      console.error(`[wallets] link error:`, e);
      toast({ variant: "destructive", title: "Linking Error", description: e?.message ?? String(e) });
    } finally {
      setLinking(false);
    }
  }

  return (
    <AppPageLayout title="Wallets" description="Link wallets to your account, verify ownership, and keep your ledger in sync.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Add a wallet</CardTitle>
            <CardDescription>Enter your EVM wallet address below to link it to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Wallet Address</label>
              <Input
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="off"
                disabled={linking}
              />
            </div>
            <Button
              onClick={handleLink}
              disabled={linking || !address}
              className="w-full"
            >
              {linking ? 'Linking...' : `Link Wallet`}
            </Button>
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
