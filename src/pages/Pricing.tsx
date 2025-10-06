// src/pages/Pricing.tsx
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  usage: string;
  highlight?: boolean;
};

const personal: Plan[] = [
  { name: "Free",     price: "$0 / mo",  usage: "Pay-as-you-go $8 / operation" },
  { name: "Standard", price: "$30 / mo", usage: "Pay-as-you-go $5 / operation", highlight: true },
  { name: "Pro",      price: "$80 / mo", usage: "Pay-as-you-go $3 / operation" },
];

const corporate: Plan[] = [
  { name: "Basic",    price: "$100 / mo", usage: "Pay-as-you-go $15 / operation" },
  { name: "Standard", price: "$250 / mo", usage: "Pay-as-you-go $10 / operation", highlight: true },
  { name: "Pro",      price: "$500 / mo", usage: "Pay-as-you-go $8 / operation" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-4xl mx-auto mt-8">
          <h1 className="text-3xl font-bold">Pricing</h1>
          <p className="text-muted-foreground mt-1">
            Operations include Transfer / Invoice / Payment / Exchange trade. 1-month free trial available (including usage).
          </p>

          <Tabs defaultValue="personal" className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="corporate">Corporate</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {personal.map(p => (
                  <Card key={p.name} className={p.highlight ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {p.name} {p.highlight && <Badge>Popular</Badge>}
                      </CardTitle>
                      <CardDescription>{p.usage}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{p.price}</div>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Transfer / Invoice / Payment / Exchange</li>
                        {p.name === "Free" && <li className="flex items-center gap-2"><Check className="h-4 w-4" /> 1-month free trial (including usage)</li>}
                      </ul>
                      <Button disabled className="w-full mt-4">Select plan (coming soon)</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="corporate" className="mt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {corporate.map(p => (
                  <Card key={p.name} className={p.highlight ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {p.name} {p.highlight && <Badge>Recommended</Badge>}
                      </CardTitle>
                      <CardDescription>{p.usage}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{p.price}</div>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4" /> Transfer / Invoice / Payment / Exchange</li>
                      </ul>
                      <Button disabled className="w-full mt-4">Select plan (coming soon)</Button>
                    </CardContent>
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
