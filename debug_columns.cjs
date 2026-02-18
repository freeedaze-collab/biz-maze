const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_audit_check.json', 'utf8'));
const txs = data.transactions || [];

console.log('=== Global Audit (366 Records) ===');
console.log(`Total Records: ${txs.length}`);

const samples = txs.filter(t => ['GTC', 'USDC', 'DAI'].includes(t.asset)).slice(0, 5);
console.log('\n--- Samples (GTC/USDC/DAI) ---');
console.log(JSON.stringify(samples, null, 2));

const assets = {};
txs.forEach(tx => {
    assets[tx.asset] = (assets[tx.asset] || 0) + 1;
});
console.log('\n--- Asset Distribution ---');
console.log(JSON.stringify(assets, null, 2));

// Check specifically for columns we added
const first = txs[0] || {};
console.log('\n--- Available Columns ---');
console.log(Object.keys(first));
