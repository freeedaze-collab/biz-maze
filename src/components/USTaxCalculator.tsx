import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Calculator, AlertTriangle, FileText, DollarSign } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface USTaxCalculatorProps {
  userId: string;
}

const USTaxCalculator = ({ userId }: USTaxCalculatorProps) => {
  const [taxData, setTaxData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const calculateTax = async (taxYear: number = new Date().getFullYear()) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-us-tax', {
        body: { userId, taxYear }
      });

      if (error) throw error;
      setTaxData(data);
      toast({
        title: "Success",
        description: "US tax calculation completed successfully",
      });
    } catch (error) {
      console.error('Error calculating US tax:', error);
      toast({
        title: "Error",
        description: "Failed to calculate US tax obligations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTaxReport = () => {
    if (!taxData) return;
    
    const dataStr = JSON.stringify(taxData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `us_tax_report_${taxData.taxYear}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const generateForm8949CSV = () => {
    if (!taxData || !taxData.capitalGains) return;
    
    const shortTermEvents = taxData.capitalGains.shortTerm.events || [];
    const longTermEvents = taxData.capitalGains.longTerm.events || [];
    const allEvents = [...shortTermEvents, ...longTermEvents];
    
    const csvHeader = "Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Gain/Loss\n";
    const csvData = allEvents.map(event => 
      `${event.currency},${new Date(event.date).toLocaleDateString()},${new Date(event.date).toLocaleDateString()},${event.salePrice},${event.costBasis},${event.gain}`
    ).join('\n');
    
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + csvData);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `form_8949_${taxData.taxYear}.csv`);
    linkElement.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calculator className="mr-2 h-5 w-5" />
          US Tax Calculator
        </CardTitle>
        <CardDescription>
          Calculate your US tax obligations for cryptocurrency transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => calculateTax(2024)} 
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <Calculator className="mb-2 h-5 w-5" />
              Calculate 2024 Taxes
            </Button>
            <Button 
              onClick={() => calculateTax(2023)} 
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <FileText className="mb-2 h-5 w-5" />
              Calculate 2023 Taxes
            </Button>
          </div>

          {taxData && (
            <div className="mt-6">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="capital-gains">Capital Gains</TabsTrigger>
                  <TabsTrigger value="income">Income</TabsTrigger>
                  <TabsTrigger value="recommendations">Tips</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tax Year {taxData.taxYear} Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <DollarSign className="mx-auto mb-2 h-8 w-8 text-green-600" />
                          <p className="text-sm text-muted-foreground">Total Taxable Income</p>
                          <p className="text-xl font-bold">${taxData.summary.totalTaxableIncome.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <FileText className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                          <p className="text-sm text-muted-foreground">Transactions</p>
                          <p className="text-xl font-bold">{taxData.summary.totalTransactions}</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-orange-600" />
                          <p className="text-sm text-muted-foreground">Taxable Events</p>
                          <p className="text-xl font-bold">{taxData.summary.taxableEvents}</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <Calculator className="mx-auto mb-2 h-8 w-8 text-purple-600" />
                          <p className="text-sm text-muted-foreground">Deductible Fees</p>
                          <p className="text-xl font-bold">${taxData.deductions.total.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="font-semibold mb-2">Required Forms</h4>
                        <div className="flex flex-wrap gap-2">
                          {taxData.forms.form8949Required && <Badge>Form 8949</Badge>}
                          {taxData.forms.scheduleD && <Badge>Schedule D</Badge>}
                          {taxData.forms.schedule1 && <Badge>Schedule 1</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="capital-gains" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Short-Term Capital Gains</CardTitle>
                        <CardDescription>Assets held ≤ 1 year (taxed as ordinary income)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total Gain/Loss:</span>
                            <span className={`font-semibold ${taxData.capitalGains.shortTerm.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${taxData.capitalGains.shortTerm.totalGain.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax Rate:</span>
                            <span>{taxData.capitalGains.shortTerm.taxRate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Events:</span>
                            <span>{taxData.capitalGains.shortTerm.events?.length || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Long-Term Capital Gains</CardTitle>
                        <CardDescription>Assets held &gt; 1 year (preferential rates)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total Gain/Loss:</span>
                            <span className={`font-semibold ${taxData.capitalGains.longTerm.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${taxData.capitalGains.longTerm.totalGain.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax Rate:</span>
                            <span>{taxData.capitalGains.longTerm.taxRate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Events:</span>
                            <span>{taxData.capitalGains.longTerm.events?.length || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="income" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ordinary Income from Cryptocurrency</CardTitle>
                      <CardDescription>Income taxed at regular rates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Mining Income</p>
                          <p className="text-lg font-semibold">${taxData.ordinaryIncome.mining.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Staking Rewards</p>
                          <p className="text-lg font-semibold">${taxData.ordinaryIncome.staking.toFixed(2)}</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Airdrops/Forks</p>
                          <p className="text-lg font-semibold">${taxData.ordinaryIncome.airdrops.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="font-semibold">Total Ordinary Income: ${taxData.ordinaryIncome.total.toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                  <div className="space-y-4">
                    {taxData.recommendations.map((rec: string, index: number) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 mt-4">
                <Button onClick={downloadTaxReport} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Tax Report
                </Button>
                <Button onClick={generateForm8949CSV} variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Form 8949 CSV
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default USTaxCalculator;