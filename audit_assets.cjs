const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_txs_optimized.json', 'utf8'));
const txs = data.transactions || [];

const assets = {};
txs.forEach(tx => {
    assets[tx.asset] = (assets[tx.asset] || 0) + 1;
});

console.log('--- Current Assets in Supabase ---');
console.log(JSON.stringify(assets, null, 2));
console.log('Total:', txs.length);

if (txs.length > 0) {
    console.log('\n--- Samples (Asset | Amount | Hash) ---');
    txs.slice(0, 10).forEach(tx => {
        console.log(`${tx.asset} | ${tx.amount} | ${tx.tx_hash.slice(0, 10)}...`);
    });
}
