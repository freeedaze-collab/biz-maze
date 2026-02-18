// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, User, CheckCircle, TrendingUp, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const AccountTypeSelection = () => {
  const [accountType, setAccountType] = useState<"individual" | "corporate" | "">("");
  const [companyType, setCompanyType] = useState<"ordinary" | "crypto" | "">("");
  const [country, setCountry] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const countries = [
    "United States", "Canada", "United Kingdom", "Germany", "France",
    "Japan", "Australia", "Singapore", "Switzerland", "Netherlands",
    "Sweden", "Norway", "Denmark", "Finland", "Austria", "Belgium",
    "Ireland", "Luxembourg", "New Zealand", "South Korea"
  ];

  const handleSave = async () => {
    if (!accountType || !country) {
      toast({
        title: "Please complete all fields",
        description: "Both account type and country are required.",
        variant: "destructive",
      });
      return;
    }

    // Corporate accounts must choose company type
    if (accountType === 'corporate' && !companyType) {
      toast({
        title: "Please select enterprise type",
        description: "Choose between Ordinary Enterprise and Crypto Enterprise.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication error",
        description: "Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          account_type: accountType,
          tax_country: country,
          plan_type: accountType === 'individual' ? 'individual_free' : 'corporate_trial',
          seats_limit: accountType === 'individual' ? 1 : 1,
          email: user.email,
          display_name: user.user_metadata?.full_name || user.email
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      // 2. For corporate accounts, create default entity with company_type
      if (accountType === 'corporate') {
        const { error: entityError } = await supabase
          .from('entities')
          .insert({
            user_id: user.id,
            name: 'Head Office',
            is_head_office: true,
            company_type: companyType || 'ordinary'
          });

        // Ignore duplicate errors (entity might already exist)
        if (entityError && !entityError.message.includes('duplicate')) {
          console.warn('Entity creation warning:', entityError.message);
        }
      }

      toast({
        title: "Account setup complete!",
        description: accountType === 'corporate'
          ? `Your ${companyType === 'crypto' ? 'Crypto' : 'Ordinary'} Enterprise account has been configured for ${country}.`
          : `Your individual account has been configured for ${country}.`,
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving account settings:', error);
      toast({
        title: "Setup failed",
        description: error.message || "Failed to complete account setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Welcome to Financial Hub!</h1>
          <p className="text-muted-foreground">
            Your email has been verified. Let's set up your account for proper tax and accounting rules.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Account Type */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Account Type</Label>
              <RadioGroup value={accountType} onValueChange={(value: "individual" | "corporate") => {
                setAccountType(value);
                if (value === 'individual') setCompanyType('');
              }}>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="individual" id="individual" />
                  <User className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor="individual" className="cursor-pointer">
                      <div className="font-medium">Individual Account</div>
                      <div className="text-sm text-muted-foreground">
                        Tax calculation only • Personal crypto management
                      </div>
                    </Label>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="corporate" id="corporate" />
                  <Building2 className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor="corporate" className="cursor-pointer">
                      <div className="font-medium">Corporate Account</div>
                      <div className="text-sm text-muted-foreground">
                        IFRS + Local tax rules • Multi-user support • Advanced compliance
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Step 2: Enterprise Type (only for Corporate) */}
            {accountType === 'corporate' && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <Label className="text-base font-semibold">Enterprise Type</Label>
                <p className="text-sm text-muted-foreground">
                  This determines how crypto assets are classified and measured in your financial statements.
                </p>
                <RadioGroup value={companyType} onValueChange={(value: "ordinary" | "crypto") => setCompanyType(value)}>
                  <div className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors ${companyType === 'ordinary' ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value="ordinary" id="ordinary" />
                    <Shield className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <Label htmlFor="ordinary" className="cursor-pointer">
                        <div className="font-medium">Ordinary Enterprise</div>
                        <div className="text-sm text-muted-foreground">
                          IAS 38 — Intangible Assets model
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Crypto held for investment or long-term value storage. Cost or revaluation model with impairment testing.
                        </div>
                      </Label>
                    </div>
                  </div>

                  <div className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors ${companyType === 'crypto' ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value="crypto" id="crypto" />
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    <div className="flex-1">
                      <Label htmlFor="crypto" className="cursor-pointer">
                        <div className="font-medium">Crypto Enterprise</div>
                        <div className="text-sm text-muted-foreground">
                          IAS 2 — Inventory (Broker-Trader) model
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Crypto traded as primary business activity. Fair value measurement with P/L impact (FVLCTS).
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Step 3: Tax Jurisdiction */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Tax Jurisdiction</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((countryName) => (
                    <SelectItem key={countryName} value={countryName}>
                      {countryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                This determines which tax and accounting rules will be applied to your account.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={!accountType || !country || (accountType === 'corporate' && !companyType) || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Setting up account..." : "Complete Setup"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountTypeSelection;