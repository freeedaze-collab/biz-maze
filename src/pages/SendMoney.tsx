// src/pages/SendMoney.tsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

export default function SendMoney() {
  const [to, setTo] = useState("");
  const [network, setNetwork] = useState("Polygon");
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState("");

  const valid = useMemo(() => {
    const amt = Number(amount);
    return to.trim().length > 0 && asset && network && !Number.isNaN(amt) && amt > 0;
  }, [to, asset, network, amount]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 将来の実装ポイント：
    // - ウォレット署名（SIWE）で本人性確認済み前提
    // - Edge Function: /send-money を叩いて送金フロー実行（外部PG or 送金API）
    console.log("[SendMoney] payload", { to, network, asset, amount: Number(amount), memo });
    alert("This is a placeholder page. Submission captured in console.");
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Send money</h1>
        <Link to="/dashboard" className="text-sm underline text-muted-foreground">
          Back to Dashboard
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Recipient (address / email)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x... or name@example.com"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Network</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
            >
              <option>Polygon</option>
              <option>Ethereum</option>
              <option>Arbitrum</option>
              <option>Base</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Asset</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
            >
              <option>USDC</option>
              <option>USDT</option>
              <option>ETH</option>
              <option>MATIC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Amount</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="any"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Memo (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Payment memo"
          />
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
