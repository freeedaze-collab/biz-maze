// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManualTransfer() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader><CardTitle>Manual Transfer</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            This is a placeholder page for manual transfers. (MVP)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
