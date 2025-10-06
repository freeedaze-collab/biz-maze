// src/pages/Profile.tsx
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setCountry(data.country ?? "US");
        setEntityType((data.entity_type as EntityType) ?? "personal");
      }
    })();
  }, [user?.id]);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        display_name: displayName || user.email,
        country,
        entity_type: entityType,
        email: user.email,
      })
      .eq("user_id", user.id);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-2xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name or company" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US / JP / ..." />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
