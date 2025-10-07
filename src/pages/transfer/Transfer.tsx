// src/pages/transfer/Transfer.tsx
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

export default function Transfer() {
  const { isConnected, address } = useAccount();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Transfer</h1>

      {!isConnected && (
        <div className="border rounded-lg p-4 mb-6 bg-yellow-50 text-sm">
          <div className="font-semibold mb-1">Wallet is not connected</div>
          <div className="mb-2">Please connect your wallet first.</div>
          <Link to="/wallet" className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded">
            Connect Wallet
          </Link>
        </div>
      )}

      {isConnected && (
        <div className="border rounded-lg p-4 mb-6 text-sm">
          <div className="font-semibold">Wallet</div>
          <div className="font-mono break-all">{address}</div>
        </div>
      )}

      <div className="grid gap-4">
        <Link to="/transfer/new" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">New recipient</div>
          <div className="text-sm text-muted-foreground">
            Create a one-time transfer or register client + wallet.
          </div>
        </Link>

        <Link to="/transfer/existing" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Existing client</div>
          <div className="text-sm text-muted-foreground">
            Pick from saved clients (with wallet) and send quickly.
          </div>
        </Link>

        <Link to="/transfer/invoice" className="block border rounded-lg p-4 hover:bg-accent">
          <div className="font-semibold">Pay from invoice</div>
          <div className="text-sm text-muted-foreground">
            Select an invoice and pay in ETH.
          </div>
        </Link>
      </div>
    </div>
  );
}
