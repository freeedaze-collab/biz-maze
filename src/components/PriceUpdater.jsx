// 例：src/components/PriceUpdater.js
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Supabaseクライアントをインポート

export default function PriceUpdater() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdatePrices = async () => {
    setIsLoading(true);
    setError(null);

    // デプロイした 'update-prices' Edge Functionを呼び出す
    const { data, error } = await supabase.functions.invoke('update-prices');

    setIsLoading(false);

    if (error) {
      console.error('Error updating prices:', error.message);
      setError('価格の更新に失敗しました。');
    } else {
      console.log('Price update successful:', data);
      setLastUpdated(new Date().toLocaleTimeString());
      // ここで、ホールディングス表示を再読み込みするなどの処理を呼び出す
      // 例: props.onPriceUpdate();
    }
  };

  return (
    <div>
      <button onClick={handleUpdatePrices} disabled={isLoading}>
        {isLoading ? '更新中...' : '資産価格を更新'}
      </button>
      {lastUpdated && <p style={{ fontSize: '0.8em', color: 'gray' }}>最終更新: {lastUpdated}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
