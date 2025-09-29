import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import { DEFAULT_CHAIN } from '@/config/wagmi';

type TxRow = {
  id: string;
  chain_id: number;
  tx_hash: string;
  timestamp: string;
  direction: 'in'|'out'|'self';
  type: string;
  asset_symbol: string;
  amount: string;
  usd_value_at_tx: string | null;
};

export default function TransactionHistory() {
  const { activeWallet, syncWalletTransactions } = useWallet();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as any);
  };

  const handleResync = async () => {
    if (!activeWallet) return;
    setLoading(true);
    try {
      await syncWalletTransactions({
        walletAddress: activeWallet.address,
        chainIds: [DEFAULT_CHAIN.id],
        cursor: null,
      });
      await fetchRows();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Transaction History</h1>
        <button
          className="px-3 py-1 rounded border"
          onClick={handleResync}
          disabled={loading || !activeWallet}
        >
          {loading ? 'Syncing…' : 'Resync (Polygon)'}
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Time (JST)</th>
            <th>Type</th>
            <th>Dir</th>
            <th>Asset</th>
            <th>Amount</th>
            <th>USD @Tx</th>
            <th>Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{new Date(r.timestamp).toLocaleString('ja-JP')}</td>
              <td>{r.type}</td>
              <td>{r.direction}</td>
              <td>{r.asset_symbol}</td>
              <td>{r.amount}</td>
              <td>{r.usd_value_at_tx ?? '-'}</td>
              <td className="truncate max-w-[160px]">
                <a
                  className="underline"
                  href={`https://polygonscan.com/tx/${r.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.tx_hash}
                </a>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-500">
                No transactions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
