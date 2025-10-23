// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, User, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const AccountTypeSelection = () => {
  const [accountType, setAccountType] = useState<"individual" | "corporate" | "">("");
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
      const { error } = await supabase
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

      if (error) throw error;

      toast({
        title: "Account setup complete!",
        description: `Your ${accountType} account has been configured for ${country}.`,
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
            <div className="space-y-4">
              <Label className="text-base font-semibold">Account Type</Label>
              <RadioGroup value={accountType} onValueChange={(value: "individual" | "corporate") => setAccountType(value)}>
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
              disabled={!accountType || !country || isLoading}
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