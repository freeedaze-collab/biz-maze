import { Link, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/UserProfile";
import {
  CreditCard,
  ArrowLeftRight,
  Banknote,
  Wallet,
  History,
  RefreshCw,
  FileCheck,
} from "lucide-react";

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: "/billing", label: "Billing", icon: CreditCard },
    { path: "/transactions", label: "Transactions", icon: ArrowLeftRight },
    { path: "/withdrawal", label: "Withdrawal Request", icon: Banknote },
    { path: "/wallet", label: "Wallet Selection", icon: Wallet },
    { path: "/transaction-history", label: "Transaction History", icon: History },
    { path: "/synthesis-status", label: "Synthesis Status Display", icon: RefreshCw },
    { path: "/invoice-status", label: "Invoice Status Check", icon: FileCheck },
  ];

  return (
    <Card className="p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Navigation</h2>
        <UserProfile showWalletInfo={true} />
      </div>
      <div className="flex flex-wrap gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};

export default Navigation;