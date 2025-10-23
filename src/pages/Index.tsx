// @ts-nocheck
// src/pages/Index.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <section className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Biz Maze</h1>
        <p className="text-muted-foreground">
          Connect your wallet, sync transactions, and automate accounting & taxes.
        </p>
      </section>

      <Card>
        <CardContent className="py-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* ✅ Get started -> Sign in */}
            <Button asChild>
              <Link to="/auth/login">Get started</Link>
            </Button>

            {/* ✅ Sign in -> /auth/login */}
            <Button asChild variant="outline">
              <Link to="/auth/login">Sign In</Link>
            </Button>

            {/* ✅ Create your account -> /auth/register（修正済み） */}
            <Button asChild variant="secondary">
              <Link to="/auth/register">Create your account</Link>
            </Button>

            {/* Pricing は誰でも見られる */}
            <Button asChild variant="ghost">
              <Link to="/pricing">Pricing</Link>
            </Button>

            {/* 🔹 ログイン済みの場合の導線追加 */}
            {user && (
              <Button asChild className="ml-2">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-1">Wallet linking</h3>
            <p className="text-sm text-muted-foreground">
              Connect MetaMask and verify. RLS-protected data model on Supabase.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-1">Accounting / Tax</h3>
            <p className="text-sm text-muted-foreground">
              Generate journal entries, P/L & trial balance, and US tax estimate.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
