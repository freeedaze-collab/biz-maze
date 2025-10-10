// src/pages/wallet/WalletSetup.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WalletRow = {
  id: string;
  address: string;
  verified: boolean | null;
  created_at: string;
};

export default function WalletSetup() {
  const { user } = useAuth();
  const [address, setAddress] = useState("");
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wallets")
      .select("id,address,verified,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user) return;
    if (!address) return alert("Please input a wallet address");
    setSaving(true);
    const { error } = await supabase.from("wallets").insert({
      user_id: user.id,
      address,
      verified: false,
    });
    setSaving(false);
    if (error) alert("Failed to save: " + error.message);
    else {
      setAddress("");
      await load();
      alert("Wallet added");
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this wallet?")) return;
    const { error } = await supabase.from("wallets").delete().eq("id", id).eq("user_id", user.id);
    if (error) alert("Failed to delete: " + error.message);
    else await load();
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Wallet Creation / Linking</h1>

      <Card>
        <CardHeader><CardTitle>MetaMask (address only for MVP)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Wallet Address</Label>
              <Input placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <Button onClick={add} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Add"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Linked Wallets</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No wallet yet.</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div>
                    <div className="font-mono text-sm break-all">{r.address}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant={r.verified ? "default" : "outline"}>
                        {r.verified ? "verified" : "unverified"}
                      </Badge>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
