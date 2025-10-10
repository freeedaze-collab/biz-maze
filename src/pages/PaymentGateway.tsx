// src/pages/PaymentGateway.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentGateway() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Payment Gateway</h1>
      <Card>
        <CardHeader>
          <CardTitle>準備中</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          決済連携（受取・支払・手数料計上など）は次フェーズで接続します。  
          まずは UI・台帳（journal_entries）までの整合性を優先して仕上げます。
        </CardContent>
      </Card>
    </div>
  );
}

