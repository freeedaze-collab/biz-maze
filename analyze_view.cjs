const fs = require('fs');
const data = JSON.parse(fs.readFileSync('sb_view_check.json', 'utf8'));
const txs = data.transactions || [];

console.log(`Total records in view: ${txs.length}`);

const gtcSample = txs.find(t => t.asset === 'GTC') || txs.find(t => t.description && t.description.includes('GTC'));
console.log('\n--- GTC Record in View ---');
console.log(JSON.stringify(gtcSample, null, 2));

const ethSample = txs.filter(t => t.asset === 'ETH').slice(0, 1);
console.log('\n--- ETH Record in View ---');
console.log(JSON.stringify(ethSample, null, 2));
