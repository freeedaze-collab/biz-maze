// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

export default function Dashboard() {
  const { isConnected } = useAccount();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {/* 主要導線 */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Link to="/wallet" className="border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Wallet Creation / Linking</div>
          <div className="text-sm text-muted-foreground">
            {isConnected ? "Wallet connected" : "Connect MetaMask"}
          </div>
        </Link>
        <Link to="/transfer" className="border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Transfer</div>
          <div className="text-sm text-muted-foreground">Send ETH to new or existing clients</div>
        </Link>
        <Link to="/billing" className="border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Create Invoice</div>
          <div className="text-sm text-muted-foreground">Create and save invoices</div>
        </Link>
      </div>

      {/* ここ以降は既存のカードや統計などを配置（未変更の想定） */}
      <div className="text-sm text-muted-foreground">
        Welcome! Use the shortcuts above to connect your wallet, create invoices, or send transfers.
      </div>
    </div>
  );
}
