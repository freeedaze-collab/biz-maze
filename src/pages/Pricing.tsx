// src/pages/Pricing.tsx
// 英語表記・個人/法人タブ・ボタンは disabled
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

type Plan = { name: string; price: string; usage: string; note?: string; highlight?: boolean };

const personal: Plan[] = [
  { name: "Free",     price: "$0 / mo",  usage: "$8 / operation",  note: "1 month free (including usage)", highlight: true },
  { name: "Standard", price: "$30 / mo", usage: "$5 / operation" },
  { name: "Pro",      price: "$80 / mo", usage: "$3 / operation" },
];

const corporate: Plan[] = [
  { name: "Basic",    price: "$100 / mo", usage: "$15 / operation" },
  { name: "Standard", price: "$250 / mo", usage: "$10 / operation", highlight: true },
  { name: "Pro",      price: "$500 / mo", usage: "$8 / operation" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-5xl mx-auto mt-8">
          <h1 className="text-3xl font-bold mb-2">Pricing</h1>
          <p className="text-muted-foreground mb-6">
            Operations include Transfer / Invoice / Payment / Exchange trade.
          </p>

          <Tabs defaultValue="personal">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="corporate">Corporate</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {personal.map((p) => (
                  <Card key={p.name} className={p.highlight ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {p.name}
                        {p.highlight && <Badge>Popular</Badge>}
                      </CardTitle>
                      <CardDescription>For individuals</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-2xl font-bold">{p.price}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4" /> {p["usage"]}
                      </div>
                      {p.note && <div className="text-xs text-green-600">{p.note}</div>}
                    </CardContent>
                    <CardFooter>
                      <Button disabled className="w-full">Select plan (coming soon)</Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="corporate" className="mt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {corporate.map((p) => (
                  <Card key={p.name} className={p.highlight ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {p.name}
                        {p.highlight && <Badge>Recommended</Badge>}
                      </CardTitle>
                      <CardDescription>For companies</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-2xl font-bold">{p.price}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4" /> {p["usage"]}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button disabled className="w-full">Select plan (coming soon)</Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
