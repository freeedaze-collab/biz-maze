// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

const Card = ({ to, title, desc }: { to: string; title: string; desc: string }) => (
  <Link to={to} className="block rounded-2xl border p-5 hover:shadow transition">
    <div className="text-lg font-semibold">{title}</div>
    <div className="text-sm text-muted-foreground">{desc}</div>
  </Link>
);

export default function Dashboard() {
  const { address, isConnected } = useAccount();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Page</h1>
        <div className="text-sm">
          Wallet:{" "}
          <span className="font-mono">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "(not connected)"}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card to="/wallet" title="Wallet Creation / Linking" desc="Connect & link your wallet" />
        <Card to="/transfer" title="Transfer" desc="Send ETH to new or saved recipients" />
        <Card to="/billing" title="Create Invoice" desc="Issue invoices like cryptoinvoice.new" />
        <Card to="/transaction-history" title="Transaction History" desc="View on-chain / records" />
        <Card to="/pricing" title="Pricing / Change Plan" desc="Check and change your plan" />
        <Card to="/accounting" title="Accounting / Tax" desc="Bookkeeping & tax calculations" />
      </div>
    </div>
  );
}
