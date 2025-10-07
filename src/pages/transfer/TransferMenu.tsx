// src/pages/transfer/TransferMenu.tsx
import { Link } from "react-router-dom";

export default function TransferMenu() {
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Transfer</h1>
      <div className="grid gap-4">
        <Link to="/transfer/new" className="rounded-xl border p-4 hover:shadow transition">
          <div className="font-semibold">New Recipient</div>
          <div className="text-sm text-muted-foreground">Enter a wallet address and amount</div>
        </Link>
        <Link to="/transfer/existing" className="rounded-xl border p-4 hover:shadow transition">
          <div className="font-semibold">Existing Client</div>
          <div className="text-sm text-muted-foreground">Pick from saved clients, then input amount</div>
        </Link>
        <Link to="/transfer/invoice" className="rounded-xl border p-4 hover:shadow transition">
          <div className="font-semibold">Pay From Invoice (PDF)</div>
          <div className="text-sm text-muted-foreground">Upload a PDF, we auto-fill what we can</div>
        </Link>
      </div>
    </div>
  );
}
