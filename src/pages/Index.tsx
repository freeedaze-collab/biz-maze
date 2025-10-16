// src/pages/Index.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Index() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Biz Maze</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            暗号資産ウォレットを接続・検証し、取引履歴を自動同期。仕訳と税務レポートまで一気通貫で。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/auth/login">
              <Button>Get started</Button>
            </Link>
            <Link to="/auth/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link to="/auth/register">
              <Button variant="outline">Create your account</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline">Pricing</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
