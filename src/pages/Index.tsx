// src/pages/Index.tsx
// メインページ：ボタンの場所は既存のまま、テキスト/スタイルを微調整
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-4xl mx-auto mt-12">
          <Card className="shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Welcome to BizMaze</CardTitle>
              <CardDescription>Streamline crypto invoices, payments and transfers.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button asChild size="lg" className="w-full">
                <Link to="/auth/login">Get started</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link to="/auth/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/auth/signup">Create your account</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full">
                <Link to="/pricing">Pricing</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
