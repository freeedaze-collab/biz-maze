// src/pages/PaymentGateway.tsx
import { useState } from "react";

const ALLOWED_NETWORKS = [
  { code: "ETH", label: "Ethereum" },
  { code: "POL", label: "Polygon" },
  { code: "BTC", label: "Bitcoin (on-chain)" },      // added
  { code: "USDC", label: "USDC (multi-chain token)" }, // added (treat as asset toggle)
  { code: "JPYC", label: "JPYC (ERC-20)" },           // added
];

export default function PaymentGateway() {
  const [enabled, setEnabled] = useState<string[]>(["ETH", "POL", "BTC"]);

  const toggle = (code: string) =>
    setEnabled((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Payment Gateway</h1>

      <div className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Allowed Networks / Assets</h2>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_NETWORKS.map((n) => (
            <button
              key={n.code}
              onClick={() => toggle(n.code)}
              className={`px-3 py-1.5 rounded border ${enabled.includes(n.code) ? "bg-blue-600 text-white" : ""}`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          * USDC / JPYC are treated as allowed assets on the selected EVM networks.  
          For BTC, only on-chain payments (SegWit) are supported in this prototype.
        </p>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">How to integrate (overview)</h2>
        <ol className="list-decimal ml-6 space-y-2 text-sm">
          <li>Choose networks/assets above and save your merchant preferences.</li>
          <li>Generate a checkout link with amount, asset, and reference (Order ID).</li>
          <li>Buyer opens the link and pays to the given address/QR.</li>
          <li>We confirm on-chain and update the invoice status via webhook/callback.</li>
        </ol>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <img src="/assets/gateway/step1.png" className="border rounded" alt="Gateway step 1" />
          <img src="/assets/gateway/step2.png" className="border rounded" alt="Gateway step 2" />
          <img src="/assets/gateway/step3.png" className="border rounded" alt="Gateway step 3" />
        </div>
        <p className="text-xs text-muted-foreground">
          (Placeholders) Put explanation images under <code>/public/assets/gateway/</code>.
        </p>
      </div>
    </div>
  );
}