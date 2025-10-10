// src/components/Navigation.tsx
import { Link, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LayoutDashboard, ArrowLeftRight, FileText, Calculator, CreditCard,
  Wallet, Tag, History, User, LogOut, Menu
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/dashboard", label: "My Page", icon: LayoutDashboard },
  { to: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { to: "/invoice", label: "Create Invoice", icon: FileText },
  { to: "/accounting", label: "Accounting/Tax", icon: Calculator },
  { to: "/payment-gateway", label: "Payment Gateway", icon: CreditCard },
  { to: "/wallet", label: "Wallet Creation/Linking", icon: Wallet },
  { to: "/transactions", label: "History", icon: History },
  { to: "/pricing", label: "Pricing/Change Plan", icon: Tag },
];

export default function Navigation() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <Card className="p-3 flex items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}>
              <Button variant={active ? "default" : "outline"} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Menu className="h-4 w-4" />
            my menu
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <div className="flex flex-col gap-2">
            <Link to="/profile">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <User className="h-4 w-4" /> プロフィール編集
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-red-600"
              onClick={async () => {
                await signOut();
                window.location.href = "/"; // メインに戻る
              }}
            >
              <LogOut className="h-4 w-4" /> サインアウト
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </Card>
  );
}
