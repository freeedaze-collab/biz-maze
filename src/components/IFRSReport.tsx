// @ts-nocheck
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface IFRSReportProps {
  userId: string;
}

const IFRSReport = ({ userId }: IFRSReportProps) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = async (reportType: 'balance_sheet' | 'income_statement') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ifrs-report', {
        body: { userId, reportType }
      });

      if (error) throw error;
      setReport(data);
      toast({
        title: "Success",
        description: "IFRS report generated successfully",
      });
    } catch (error) {
      console.error('Error generating IFRS report:', error);
      toast({
        title: "Error",
        description: "Failed to generate IFRS report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `ifrs_${report.reportType.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          IFRS Accounting Reports
        </CardTitle>
        <CardDescription>
          International Financial Reporting Standards compliant reports for your cryptocurrency holdings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => generateReport('balance_sheet')} 
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <FileText className="mb-2 h-5 w-5" />
              Generate Balance Sheet
            </Button>
            <Button 
              onClick={() => generateReport('income_statement')} 
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <TrendingUp className="mb-2 h-5 w-5" />
              Generate Income Statement
            </Button>
          </div>

          {report && (
            <div className="mt-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{report.reportType}</CardTitle>
                      <CardDescription>
                        Report Date: {new Date(report.reportDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {report.reportType === 'IFRS Balance Sheet' && report.assets && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2">Assets</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Digital Assets</span>
                                <span className="font-medium">${report.assets.currentAssets.digitalAssets.totalValue.toFixed(2)}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {report.assets.currentAssets.digitalAssets.accountingPolicy}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Equity</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Retained Earnings</span>
                                <span className="font-medium">${report.equity.retainedEarnings.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Unrealized Gains</span>
                                <span className="font-medium text-green-600">${report.equity.unrealizedGains.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {report.reportType === 'IFRS Income Statement' && report.income && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Realized Gains</p>
                                  <p className="text-lg font-semibold text-green-600">
                                    ${report.income.realizedGains.toFixed(2)}
                                  </p>
                                </div>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                              </div>
                            </Card>
                            <Card className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Unrealized Gains</p>
                                  <p className="text-lg font-semibold text-blue-600">
                                    ${report.income.unrealizedGains.toFixed(2)}
                                  </p>
                                </div>
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                              </div>
                            </Card>
                            <Card className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Net Income</p>
                                  <p className="text-lg font-semibold">
                                    ${report.netIncome.toFixed(2)}
                                  </p>
                                </div>
                                {report.netIncome >= 0 ? 
                                  <TrendingUp className="h-5 w-5 text-green-600" /> :
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                }
                              </div>
                            </Card>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="details">
                  <Card>
                    <CardHeader>
                      <CardTitle>Full Report Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
                        {JSON.stringify(report, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end mt-4">
                <Button onClick={downloadReport} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IFRSReport;