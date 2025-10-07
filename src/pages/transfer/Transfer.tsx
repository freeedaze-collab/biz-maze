import { Link } from "react-router-dom";

export default function Transfer() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Transfer</h1>

      <div className="grid gap-4">
        <Link to="/transfer/new" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">New recipient</div>
          <div className="text-sm text-muted-foreground">Create a one-time transfer or register client + wallet.</div>
        </Link>

        <Link to="/transfer/existing" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Existing client</div>
          <div className="text-sm text-muted-foreground">Pick from saved clients (with wallet) and send quickly.</div>
        </Link>

        <Link to="/transfer/invoice" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Pay from invoice</div>
          <div className="text-sm text-muted-foreground">Select an invoice and pay in ETH.</div>
        </Link>
      </div>
    </div>
  );
}
