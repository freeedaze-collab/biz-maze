// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";

export default function Index() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-16 text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">All-in-one Crypto Toolkit</h1>
          <p className="text-muted-foreground">
            Transfer, invoice, and manage your crypto business with ease.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => nav("/auth/login")}>Get started</Button>
            <Button size="lg" variant="secondary" onClick={() => nav("/auth/login")}>Sign In</Button>
            <Button size="lg" variant="outline" onClick={() => nav("/auth/signup")}>Create your account</Button>
            <Button size="lg" variant="ghost" onClick={() => nav("/pricing")}>Pricing</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
