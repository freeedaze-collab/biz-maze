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
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>表示名</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div>
              <Label>国</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
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

            <div>
              <Label>区分</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">個人</SelectItem>
                  <SelectItem value="corporate">法人</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={save} disabled={saving || !user}>
              {saving ? "Saving..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
