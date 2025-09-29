import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useWallet } from '@/hooks/useWallet';
import { DEFAULT_CHAIN } from '@/config/wagmi';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type TxRow = {
  id: string;
  user_id: string;
  chain_id: number;
  network?: string | null;
  tx_hash: string;
  log_index: number;
  timestamp: string; // ISO
  direction: 'in' | 'out' | 'self';
  type: string;
  from_address: string;
  to_address: string;
  asset_contract: string | null;
  asset_symbol: string;
  asset_decimals: number;
  amount: string; // human readable
  fee_native?: string | null;
  usd_value_at_tx?: string | null;
  usd_fee_at_tx?: string | null;
  price_source?: string | null;
};

export default function AccountingTaxScreen1() {
  const { syncAllWallets } = useWallet();

  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .eq('chain_id', DEFAULT_CHAIN.id)
      .order('timestamp', { ascending: false })
      .limit(1000);
    if (!error && data) setRows(data as any);
  };

  const onSyncAll = async () => {
    setLoading(true);
    try {
      await syncAllWallets();  // Polygonのみ同期
      await fetchRows();       // 同期後に再取得
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  // すごく簡易な集計（USD換算が入っている分だけ）
  const summary = useMemo(() => {
    const totalUsd = rows.reduce((acc, r) => acc + (Number(r.usd_value_at_tx ?? 0) || 0), 0);
    const totalCount = rows.length;
    return { totalUsd, totalCount };
  }, [rows]);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounting / Tax (Polygon)</h1>
        <button
          onClick={onSyncAll}
          disabled={loading}
          className="px-4 py-2 rounded border disabled:opacity-50"
        >
          {loading ? 'Syncing…' : 'Sync All (Polygon WETH)'}
        </button>
      </div>

      <section className="rounded border p-4">
        <h2 className="font-semibold mb-2">Summary (very basic)</h2>
        <div className="text-sm">
          <div>Total tx rows: <b>{summary.totalCount}</b></div>
          <div>Sum of USD@Tx (visible rows): <b>${summary.totalUsd.toFixed(2)}</b></div>
        </div>
      </section>

      <section className="rounded border p-4 overflow-auto">
        <h2 className="font-semibold mb-2">Transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Time (JST)</th>
              <th>Type</th>
              <th>Dir</th>
              <th>Asset</th>
              <th>Amount</th>
              <th>USD @Tx</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.tx_hash}-${r.log_index}`} className="border-b">
                <td className="py-2">{new Date(r.timestamp).toLocaleString('ja-JP')}</td>
                <td>{r.type}</td>
                <td>{r.direction}</td>
                <td>{r.asset_symbol}</td>
                <td>{r.amount}</td>
                <td>{r.usd_value_at_tx ?? '-'}</td>
                <td className="truncate max-w-[200px]">
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
                <td colSpan={7} className="py-6 text-center text-gray-500">No data.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
