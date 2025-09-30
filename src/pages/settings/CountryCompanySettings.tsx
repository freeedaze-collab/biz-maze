import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Building } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const CountryCompanySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [country, setCountry] = useState("");
  const [entityType, setEntityType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const countries = [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
    { value: "UK", label: "United Kingdom" },
    { value: "DE", label: "Germany" },
    { value: "FR", label: "France" },
    { value: "JP", label: "Japan" },
    { value: "AU", label: "Australia" },
    { value: "SG", label: "Singapore" },
    { value: "OTHER", label: "Other" },
  ];

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCountry(data.tax_country || "");
        setEntityType(data.entity_type || "");
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!country || !entityType) {
      toast({
        title: "Missing Information",
        description: "Please select both country and entity type.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          tax_country: country,
          entity_type: entityType,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your country and entity type have been updated.",
      });

      // Navigate back to accounting/tax page
      navigate("/accounting-tax");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/accounting-tax" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Accounting & Tax
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Tax & Accounting Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure your country and entity type for accurate tax calculations and accounting reports
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Tax Jurisdiction
              </CardTitle>
              <CardDescription>
                Select your country to ensure compliance with local tax regulations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="country">Country/Region</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Entity Type
              </CardTitle>
              <CardDescription>
                Specify whether you're filing as an individual or business entity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={entityType} onValueChange={setEntityType}>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="personal" id="personal" />
                    <Label htmlFor="personal" className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-medium">Personal/Individual</p>
                        <p className="text-sm text-muted-foreground">
                          Filing taxes as an individual taxpayer
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="company" id="company" />
                    <Label htmlFor="company" className="flex-1 cursor-pointer">
                      <div>
                        <p className="font-medium">Business/Company</p>
                        <p className="text-sm text-muted-foreground">
                          Filing taxes as a business entity or corporation
                        </p>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="mt-8 flex gap-4">
            <Button 
              onClick={handleSave} 
              disabled={isLoading || !country || !entityType}
              className="flex-1"
            >
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryCompanySettings;