// @ts-nocheck
// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type EntityType = "personal" | "corporate";

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("US");
  const [entityType, setEntityType] = useState<EntityType>("personal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, country, entity_type")
        .eq("user_id", user.id) // ✅ user_id で取得
        .maybeSingle();
      if (!error && data) {
        setDisplayName(data.display_name ?? "");
        setCountry(data.country ?? "US");
        setEntityType((data.entity_type ?? "personal") as EntityType);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,          // 運用維持（id = auth id）
        user_id: user.id,     // ✅ NOT NULL のため必ず保存
        display_name: displayName,
        country,
        entity_type: entityType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" } // user_id 重複で更新
    );
    setSaving(false);
    if (error) {
      alert("保存に失敗しました: " + error.message);
    } else {
      alert("保存しました");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="mx-auto max-w-3xl p-6 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent p-8 text-primary-foreground shadow-elegant">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">Profile Settings</h1>
            <p className="text-primary-foreground/90">Manage your account information and preferences</p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-primary-foreground/10 rounded-full blur-2xl"></div>
        </div>

        <Card className="shadow-lg border-2 hover:border-primary/30 transition-colors">
          <CardHeader className="border-b bg-gradient-to-r from-card to-primary/5">
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              基本情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">表示名</Label>
                <Input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="border-2 focus:border-primary transition-colors"
                  placeholder="Enter your display name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">国</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="border-2 focus:border-primary transition-colors">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {["US", "JP", "PH", "GB", "DE", "SG"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-semibold text-foreground">区分</Label>
                <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                  <SelectTrigger className="border-2 focus:border-primary transition-colors">
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">個人</SelectItem>
                    <SelectItem value="corporate">法人</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button onClick={save} disabled={saving || !user} className="flex-1" size="lg">
                {saving ? "Saving..." : "保存"}
              </Button>
              <Button variant="outline" disabled={saving} className="flex-1" size="lg">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
