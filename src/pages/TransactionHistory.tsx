
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

// Define the types for our data for better type-checking
type Holding = {
  asset: string;
  current_amount: number;
  current_price: number;
  current_value: number;
  average_buy_price: number;
  total_cost: number;
  realized_capital_gain_loss: number;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  asset: string;
  amount: number;
  transaction_type: string;
};

export default function TransactionsDashboard() {
  const supabase = createClient();

  // State for holding our data
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // State for managing loading and errors
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State specifically for the price update functionality
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // A single function to fetch all required data from the database
  const fetchData = useCallback(async () => {
    console.log("Fetching holdings and transactions data...");
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both v_holdings and v_all_transactions_classified concurrently
      const [holdingsResponse, transactionsResponse] = await Promise.all([
        supabase.from('v_holdings').select('*'),
        supabase.from('v_all_transactions_classified').select('*').order('date', { ascending: false }).limit(100)
      ]);

      if (holdingsResponse.error) throw new Error(`Holdings Error: ${holdingsResponse.error.message}`);
      if (transactionsResponse.error) throw new Error(`Transactions Error: ${transactionsResponse.error.message}`);

      setHoldings(holdingsResponse.data as Holding[]);
      setTransactions(transactionsResponse.data as Transaction[]);
      console.log("Data fetched successfully.");

    } catch (e: any) {
      console.error("Data fetching failed:", e.message);
      setError('データの読み込みに失敗しました。データベースの接続を確認してください。');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch data when the component first loads
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler for the "Update Prices" button
  const handleUpdatePrices = async () => {
    console.log("Invoking 'update-prices' function...");
    setIsUpdatingPrices(true);
    setUpdateError(null);

    // 1. Invoke the edge function we created
    const { error: functionError } = await supabase.functions.invoke('update-prices');

    if (functionError) {
      console.error('Error updating prices:', functionError.message);
      setUpdateError('価格の更新に失敗しました。');
      setIsUpdatingPrices(false);
    } else {
      console.log('Price update function succeeded. Refreshing data...');
      setLastUpdated(new Date().toLocaleTimeString());
      
      // 2. IMPORTANT: Re-fetch the data to show the new values
      await fetchData(); 
      
      setIsUpdatingPrices(false);
    }
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  // Helper to format numbers as currency
  const formatCurrency = (value: number) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);


  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>資産ダッシュボード</h1>

      {/* --- Price Update Section --- */}
      <div style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <button onClick={handleUpdatePrices} disabled={isUpdatingPrices}>
          {isUpdatingPrices ? '更新中...' : '資産価格を更新 (リアルタイム)'}
        </button>
        {lastUpdated && <p style={{ fontSize: '0.8em', color: 'gray' }}>最終更新: {lastUpdated}</p>}
        {updateError && <p style={{ color: 'red' }}>{updateError}</p>}
      </div>

      {/* --- Holdings Table (v_holdings) --- */}
      <h2>現在の保有資産</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>保有資産</th>
            <th style={tableHeaderStyle}>保有量</th>
            <th style={tableHeaderStyle}>現在価格</th>
            <th style={tableHeaderStyle}>現在の評価額</th>
            <th style={tableHeaderStyle}>平均取得単価</th>
            <th style={tableHeaderStyle}>実現損益</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => (
            <tr key={h.asset}>
              <td style={tableCellStyle}>{h.asset}</td>
              <td style={tableCellStyle}>{h.current_amount.toFixed(6)}</td>
              <td style={tableCellStyle}>{formatCurrency(h.current_price)}</td>
              <td style={tableCellStyle}>{formatCurrency(h.current_value)}</td>
              <td style={tableCellStyle}>{formatCurrency(h.average_buy_price)}</td>
              <td style={tableCellStyle}>{formatCurrency(h.realized_capital_gain_loss)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- Transactions Table (v_all_transactions_classified) --- */}
      <h2 style={{ marginTop: '3rem' }}>全取引履歴 (直近100件)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>日時</th>
            <th style={tableHeaderStyle}>内容</th>
            <th style={tableHeaderStyle}>資産</th>
            <th style={tableHeaderStyle}>数量</th>
            <th style={tableHeaderStyle}>種別</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td style={tableCellStyle}>{new Date(t.date).toLocaleString()}</td>
              <td style={tableCellStyle}>{t.description}</td>
              <td style={tableCellStyle}>{t.asset}</td>
              <td style={tableCellStyle}>{t.amount.toFixed(6)}</td>
              <td style={tableCellStyle}>{t.transaction_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Basic styling for the tables
const tableHeaderStyle = {
  borderBottom: '2px solid #333',
  padding: '8px',
  textAlign: 'left' as const,
  backgroundColor: '#f2f2f2'
};

const tableCellStyle = {
  borderBottom: '1px solid #ddd',
  padding: '8px',
};

