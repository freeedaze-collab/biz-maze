import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Zap, Crown, Star } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      description: "Perfect for individuals getting started with crypto",
      icon: <Zap className="h-6 w-6" />,
      popular: false,
      features: [
        "Connect up to 2 wallets",
        "Basic transaction history",
        "Simple payment processing",
        "Email support",
        "Mobile app access",
        "Basic analytics"
      ],
      limitations: [
        "Limited to $1,000/month volume",
        "Standard processing speed"
      ]
    },
    {
      name: "Professional",
      price: "$29",
      period: "per month",
      description: "Ideal for small businesses and active traders",
      icon: <Star className="h-6 w-6" />,
      popular: true,
      features: [
        "Connect up to 10 wallets",
        "Advanced transaction history",
        "Priority payment processing",
        "24/7 chat support",
        "Mobile & desktop apps",
        "Advanced analytics & reporting",
        "Tax optimization tools",
        "API access",
        "Multi-currency support"
      ],
      limitations: [
        "Up to $50,000/month volume"
      ]
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "per month",
      description: "For large organizations and institutions",
      icon: <Crown className="h-6 w-6" />,
      popular: false,
      features: [
        "Unlimited wallet connections",
        "Complete transaction management",
        "Instant payment processing",
        "Dedicated account manager",
        "All platform access",
        "Custom analytics dashboard",
        "Advanced tax & compliance tools",
        "Full API access",
        "Multi-currency & DeFi support",
        "White-label options",
        "Custom integrations",
        "SLA guarantee"
      ],
      limitations: [
        "Unlimited volume"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Scale your crypto operations with our flexible pricing plans. 
              Start free and upgrade as you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card 
                key={plan.name} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold">
                    {plan.price}
                    <span className="text-base font-normal text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm uppercase tracking-wide">
                      Included Features
                    </h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.limitations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                        Limits
                      </h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, limitIndex) => (
                          <li key={limitIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className="w-4 h-4 mt-0.5 flex-shrink-0">
                              <div className="w-1 h-1 bg-muted-foreground rounded-full mx-auto mt-1.5"></div>
                            </div>
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    {plan.price === "$0" ? "Get Started Free" : `Choose ${plan.name}`}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {plan.price === "$0" 
                      ? "No credit card required" 
                      : "Cancel anytime • 30-day money back guarantee"
                    }
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Need a custom solution?</h2>
            <p className="text-muted-foreground mb-6">
              Contact our sales team for enterprise pricing and custom features
            </p>
            <Button variant="outline" size="lg">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;