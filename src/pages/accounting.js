import React, { useState } from 'react';

export default function Accounting() {
  const [entries, setEntries] = useState(null);
  const [formula, setFormula] = useState('');

  const generateEntries = () => {
    // ボタン押下時に表示する仕訳例と計算式（例示用）
    const exampleEntries = [
      { description: '売上返戻金', debit: '100', credit: '現金100' },
      { description: '消費税', debit: '10', credit: '仮受消費税10' }
    ];
    const exampleFormula = '100 = 1000 × 0.1 (例：消費税10%を計算)';
    setEntries(exampleEntries);
    setFormula(exampleFormula);
  };

  return (
    <div>
      <h2>会計タブ</h2>
      <button onClick={generateEntries}>仕訳・計算式を表示</button>

      {entries && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
          {/* 仕訳表示 */}
          <h3>仕訳 (Journal Entries)</h3>
          <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>摘要</th>
                <th>借方</th>
                <th>貸方</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={idx}>
                  <td>{entry.description}</td>
                  <td>{entry.debit}</td>
                  <td>{entry.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 計算式表示 */}
          <h3 style={{ marginTop: '15px' }}>計算式 (Calculation Formula)</h3>
          <p>{formula}</p>
        </div>
      )}
    </div>
  );
}
