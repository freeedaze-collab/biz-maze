// src/pages/TransactionHistory.tsx
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error.message);
        setTransactions([]);
      } else {
        setTransactions(data ?? []);
      }
      setLoading(false);
    };

    fetchTransactions();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (transactions.length === 0) {
    return (
      <div>
        <h2>Transaction History</h2>
        <p>No transactions yet.</p>
        <p>Total: 0</p>
      </div>
    );
  }

  const total = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div>
      <h2>Transaction History</h2>
      <p>Total: {total}</p>
      <ul>
        {transactions.map((tx) => (
          <li key={tx.id}>
            {tx.created_at}: {tx.amount} ({tx.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
