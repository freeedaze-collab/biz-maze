import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  const [planType, setPlanType] = useState<"individual" | "corporate">("individual");

  const individualPlans = [
    { name: "Free", price: "$0", usage: "$8 / transaction" },
    { name: "Standard", price: "$30", usage: "$5 / transaction" },
    { name: "Pro", price: "$80", usage: "$3 / transaction" },
  ];

  const corporatePlans = [
    { name: "Basic", price: "$100", usage: "$15 / transaction" },
    { name: "Standard", price: "$250", usage: "$10 / transaction" },
    { name: "Pro", price: "$500", usage: "$8 / transaction" },
  ];

  const plans = planType === "individual" ? individualPlans : corporatePlans;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Pricing Plans</h1>
      <div className="flex gap-4 mb-6">
        <Button
          variant={planType === "individual" ? "default" : "outline"}
          onClick={() => setPlanType("individual")}
        >
          Individual
        </Button>
        <Button
          variant={planType === "corporate" ? "default" : "outline"}
          onClick={() => setPlanType("corporate")}
        >
          Corporate
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{plan.price}</p>
              <p className="text-sm text-gray-500">{plan.usage}</p>
              {planType === "individual" && plan.name === "Free" && (
                <p className="text-xs mt-2 text-green-600">1 month free trial (including usage)</p>
              )}
            </CardContent>
            <CardFooter>
              <Button className="w-full" disabled>
                Select Plan
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
