// @ts-nocheck
// src/pages/Pricing.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Plan = {
  name: string;
  price: number;
  usageNote?: string;
  features: string[];
};

const companyPlans: Plan[] = [
  { name: "Company $100", price: 100, usageNote: undefined, features: [] },
  { name: "Company $250", price: 250, usageNote: undefined, features: [] },
  { name: "Company $500", price: 500, usageNote: undefined, features: [] },
];

const companyMetered = [
  "送金 → $8/件",
  "請求書発行 → $8/件",
  "決済 → $8/件",
  "取引所取引 → $8/件",
];

const personalPlans: Plan[] = [
  { name: "Personal $0", price: 0, usageNote: "従量 → $10/件", features: [] },
  { name: "Personal $30", price: 30, usageNote: "従量 → $5/件", features: [] },
  { name: "Personal $80", price: 80, usageNote: "従量 → $2/件", features: [] },
];

const personalExtra = ["取引所取引 → $5/件", "無料1ヶ月あり（従量分も無料）"];

export default function Pricing() {
  const [tab, setTab] = useState<"company" | "personal">("company");
  const [entityType, setEntityType] = useState<"personal" | "corporate" | null>(null);
  const [loading, setLoading] = useState(true);

  // 既存構成を壊さないよう、ログイン時のみプロフィールから自動出し分け
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: session } = await supabase.auth.getSession();
        const uid = session.session?.user.id;
        if (!uid) {
          setEntityType(null); // 未ログイン＝従来のタブUIをそのまま表示
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("entity_type")
          .eq("id", uid) // あなたの既存実装に合わせて id = auth.users.id
          .maybeSingle();

        const et = (prof?.entity_type as "personal" | "corporate" | undefined) ?? "personal";
        setEntityType(et);
        // 片側のみ表示の要件に合わせ、タブの初期値も合わせる
        setTab(et === "corporate" ? "company" : "personal");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // entityType が判明している場合は、そのプランのみ表示（もう片方は隠す）
  const showOnlyOne = entityType !== null;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pricing</h1>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : showOnlyOne ? (
        // 片側だけ出す（求められた挙動）。タブは出さない。
        entityType === "corporate" ? (
          <div className="mt-6">
            <div className="text-sm text-muted-foreground mb-4">法人プランを表示中（プロフィールの区分に基づく）</div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {companyPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">月額</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    <div className="text-sm text-muted-foreground">従量課金</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {companyMetered.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <Button className="w-full" disabled>
                      申し込む（準備中）
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div className="text-sm text-muted-foreground mb-4">個人プランを表示中（プロフィールの区分に基づく）</div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {personalPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">月額</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    {p.usageNote && (
                      <div className="text-sm text-muted-foreground">{p.usageNote}</div>
                    )}
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {personalExtra.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <Button className="w-full" disabled>
                      申し込む（準備中）
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      ) : (
        // 未ログインやプロフィール未取得時は従来のタブUIを維持
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList>
            <TabsTrigger value="company">法人</TabsTrigger>
            <TabsTrigger value="personal">個人</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {companyPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">月額</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    <div className="text-sm text-muted-foreground">従量課金</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {companyMetered.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>

                    <Button className="w-full" disabled>
                      申し込む（準備中）
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="personal" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {personalPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">月額</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    {p.usageNote && (
                      <div className="text-sm text-muted-foreground">{p.usageNote}</div>
                    )}
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {personalExtra.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>

                    <Button className="w-full" disabled>
                      申し込む（準備中）
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>無料トライアル</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <Badge className="mr-2">1ヶ月無料</Badge>
                    従量分も無料になります。
                  </div>
                  <div className="text-sm text-muted-foreground">
                    トライアル後は選択プランに従って課金（決済ボタンは現在無効化中）
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
